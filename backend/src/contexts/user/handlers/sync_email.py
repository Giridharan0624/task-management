"""PUT /users/me/email — sync a post-verification email change to DDB.

Called by the frontend's change-email flow AFTER Cognito has already
updated the email attribute + completed the code challenge (so the
new JWT's `email` claim is the updated address). Cognito is the
source of truth for the attribute; DDB is the source of truth for
everything else about the user record.

Flow, end-to-end:
  1. User enters a new email on the profile page.
  2. Frontend calls Cognito SDK `updateAttributes` → Cognito mails a
     6-digit code to the new address + sets `email_verified=false`.
  3. User enters the code → frontend calls `verifyAttribute` → Cognito
     commits the new email + flips `email_verified=true`.
  4. Frontend calls `refreshSession()` → new ID token carries the
     updated `email` claim.
  5. Frontend calls THIS endpoint → we write the new email onto the
     DDB User record so list views, notifications, etc. see it too.

No body required — the new email is taken straight from the JWT. We
reject if the email is already in use by another user (global
uniqueness is enforced at the Cognito-alias level too, but
re-checking here gives a cleaner error than a DDB collision).
"""
from __future__ import annotations

from datetime import datetime, timezone

from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)

        jwt_email = (auth.email or "").strip().lower()
        if not jwt_email:
            raise ValidationError("No email in the current session.")

        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(auth.user_id)
        if not user:
            raise NotFoundError(f"User {auth.user_id} not found.")

        current_email = (user.email or "").strip().lower()
        if current_email == jwt_email:
            # No-op — DDB is already in sync with the JWT. Harmless to
            # call this endpoint after a refreshSession() that didn't
            # actually change anything.
            return build_success(200, {
                "email": current_email,
                "updated": False,
            })

        # Global uniqueness re-check. Cognito already enforces this at
        # the alias level (two users can't share an email in a single
        # pool), but surfacing a clear message here is better than
        # letting the conflict bubble up from a DDB collision.
        existing = user_repo.find_by_email(jwt_email)
        if existing and existing.user_id != user.user_id:
            raise ValidationError(
                f"Another user is already registered with {jwt_email}.",
            )

        # Build a shallow copy with the new email + updated_at. Using
        # model_copy so the rest of the record (employee_id, role, etc.)
        # stays untouched.
        updated = user.model_copy(update={
            "email": jwt_email,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        user_repo.update(updated)
        return build_success(200, {
            "email": jwt_email,
            "updated": True,
            "previous_email": current_email,
        })
    except Exception as e:
        return build_error(e)
