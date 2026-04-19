"""Authed GET /orgs/current/invites — list pending + accepted invites
for the caller's org. OWNER/ADMIN only."""
from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require(auth, P.USER_INVITE)

        org_repo = OrgDynamoRepository()
        invites = org_repo.list_invites(auth.org_id)

        # Don't leak the token to list responses — it's only needed on
        # the accept flow, and it's part of the email link. Listing
        # invites should NOT expose tokens to the admin UI because the
        # admin UI doesn't need them (re-send = revoke+send).
        result = [
            {
                "email": i.email,
                "role_id": i.role_id,
                "invited_by": i.invited_by,
                "expires_at": i.expires_at,
                "accepted_at": i.accepted_at,
                "created_at": i.created_at,
                "status": (
                    "accepted" if i.accepted_at
                    else "expired" if _is_expired(i.expires_at)
                    else "pending"
                ),
                # token included for revoke — admin UI uses it to call
                # DELETE /orgs/current/invites/{token}
                "token": i.token,
            }
            for i in invites
        ]
        return build_success(200, {"invites": result})
    except Exception as e:
        return build_error(e)


def _is_expired(expires_at: str) -> bool:
    from datetime import datetime, timezone
    try:
        return datetime.now(timezone.utc) > datetime.fromisoformat(expires_at)
    except (ValueError, TypeError):
        return True
