"""POST /orgs/current/transfer-ownership — promote a user to OWNER.

Only the current OWNER can initiate. Both Cognito attributes and the
DynamoDB user record are updated atomically (best-effort: Cognito
update first, then DDB; rollback the Cognito change if DDB fails).

This is a one-step transfer for v1 (no accept-ceremony from the new
owner). A future enhancement adds an invite-style flow where the new
owner must explicitly accept before the swap commits.

Not yet wired in CDK (stack at 494/500). Drop into an admin router
alongside roles_router after the nested-stack refactor.
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel

from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.domain.value_objects import SystemRole
from contexts.user.infrastructure.cognito_service import CognitoService
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import (
    invalidate_role_cache,
    require,
    require_not_suspended,
)
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: str
    confirm_email: str   # must equal the new owner's email — guard against typos


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # Only OWNER can transfer — guarded explicitly even though
        # role.manage is OWNER-only by default, because the stakes are
        # higher here (irreversible without the new owner cooperating).
        if (auth.role_id or auth.system_role).lower() != "owner":
            raise AuthorizationError(
                "Only the current owner can transfer ownership."
            )
        # And require the matching permission so a future custom role
        # can't grant ownership-transfer to a non-owner.
        require(auth, P.ROLE_MANAGE)

        req = validate_body(TransferOwnershipRequest, event.get("body"))
        new_owner_id = req.new_owner_user_id.strip()
        if not new_owner_id:
            raise ValidationError("new_owner_user_id is required.")
        if new_owner_id == auth.user_id:
            raise ValidationError("You are already the owner.")

        user_repo = UserDynamoRepository()
        org_repo = OrgDynamoRepository()

        new_owner = user_repo.find_by_id(new_owner_id)
        if not new_owner:
            raise NotFoundError(f"User {new_owner_id} not found.")
        if new_owner.email.strip().lower() != req.confirm_email.strip().lower():
            raise ValidationError(
                "Email confirmation did not match the target user's email.",
            )

        current_owner = user_repo.find_by_id(auth.user_id)
        if not current_owner:
            raise NotFoundError("Current owner record not found.")

        cognito = CognitoService()

        # Step 1: Cognito role swap. Do new-owner promote first; if it
        # fails we abort cleanly with no half-state.
        try:
            cognito.update_user_role(new_owner.email, SystemRole.OWNER.value)
        except Exception as e:
            raise ValidationError(f"Failed to promote new owner in Cognito: {e}")

        # Step 2: demote current owner. If this fails, undo step 1.
        try:
            cognito.update_user_role(
                current_owner.email, SystemRole.ADMIN.value,
            )
        except Exception as e:
            try:
                cognito.update_user_role(new_owner.email, new_owner.system_role.value)
            except Exception:
                pass  # best-effort rollback
            raise ValidationError(f"Failed to demote current owner in Cognito: {e}")

        # Step 3: DynamoDB updates.
        now = datetime.now(timezone.utc).isoformat()
        promoted = new_owner.model_copy(update={
            "system_role": SystemRole.OWNER, "updated_at": now,
        })
        demoted = current_owner.model_copy(update={
            "system_role": SystemRole.ADMIN, "updated_at": now,
        })
        user_repo.update(promoted)
        user_repo.update(demoted)

        # Step 4: update Org.owner_user_id (Phase 1 entity field).
        org = org_repo.find_by_id(auth.org_id)
        if org:
            org.owner_user_id = new_owner_id
            org.updated_at = now
            org_repo.save(org)

        invalidate_role_cache(auth.org_id)
        audit.record(
            auth,
            action=audit.ORG_OWNERSHIP_TRANSFERRED,
            target={"type": "org", "id": auth.org_id},
            summary=(
                f"Transferred ownership from {current_owner.email} to "
                f"{new_owner.email}"
            ),
            metadata={
                "previous_owner_id": auth.user_id,
                "new_owner_id": new_owner_id,
            },
        )
        return build_success(200, {
            "previous_owner_id": auth.user_id,
            "new_owner_id": new_owner_id,
            "transferred_at": now,
        })
    except Exception as e:
        return build_error(e)
