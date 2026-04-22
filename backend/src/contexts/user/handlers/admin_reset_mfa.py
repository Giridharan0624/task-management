"""POST /users/{userId}/mfa/reset — OWNER resets another user's 2FA.

Recovery escape hatch for the TOTP flow. If a user loses access to
their authenticator app (phone lost / reset / uninstalled), they
can't complete the SOFTWARE_TOKEN_MFA challenge on sign-in. An OWNER
hits this endpoint, which calls Cognito `AdminSetUserMFAPreference`
to disable both SMS and TOTP factors on the target user. Target user
can then sign in with password alone, and re-enroll from their
/profile/mfa page afterwards.

Access control:
  - OWNER only. Not delegated to a permission string because
    resetting MFA weakens account security and should be reserved
    for the single-owner audit trail. A future enhancement could
    add a `user.reset_mfa` permission if multi-admin tenants need
    the flexibility.
  - Caller cannot reset their own MFA here (use /profile/mfa instead
    — the self-serve path knows whether the caller has a valid
    session without bypassing the challenge).
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import boto3

from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import require_email_verified, require_not_suspended
from shared_kernel.response import build_error, build_success

cognito_client = boto3.client(
    "cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"),
)
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # Don't let an unverified-email OWNER reset someone else's 2FA —
        # otherwise a compromised signup could escalate.
        require_email_verified(auth)

        if (auth.role_id or auth.system_role).lower() != "owner":
            raise AuthorizationError("Only the workspace owner can reset 2FA.")

        path = event.get("pathParameters") or {}
        target_user_id = (path.get("userId") or "").strip()
        if not target_user_id:
            raise ValidationError("userId path parameter is required.")
        if target_user_id == auth.user_id:
            raise ValidationError(
                "Use /profile/mfa to manage your own 2FA settings.",
            )

        user_repo = UserDynamoRepository()
        target = user_repo.find_by_id(target_user_id)
        if not target:
            raise NotFoundError(f"User {target_user_id} not found.")

        # AdminSetUserMFAPreference with all factors disabled clears the
        # SOFTWARE_TOKEN_MFA preference. Cognito leaves the associated
        # software-token device in place (idempotent — re-enrollment
        # doesn't require deleting the old device first), but stops
        # challenging on sign-in.
        cognito_client.admin_set_user_mfa_preference(
            UserPoolId=USER_POOL_ID,
            Username=target.email,
            SoftwareTokenMfaSettings={"Enabled": False, "PreferredMfa": False},
            SMSMfaSettings={"Enabled": False, "PreferredMfa": False},
        )

        audit.record(
            auth,
            action="user.mfa_reset",
            target={"type": "user", "id": target_user_id},
            summary=f"Reset 2FA for {target.email}",
            metadata={"reset_by_owner": True},
        )
        return build_success(200, {
            "user_id": target_user_id,
            "email": target.email,
            "mfa_reset_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        return build_error(e)
