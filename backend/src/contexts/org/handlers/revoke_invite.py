"""Authed DELETE /orgs/current/invites/{token} — OWNER/ADMIN revokes
an outstanding invite. Removes both the org-scoped record and the
global INVITE_TOKEN# lookup so the link becomes unresolvable."""
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.domain.value_objects import PRIVILEGED_ROLES
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        if auth.system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError(
                "Only owners and admins can revoke invites."
            )

        token = (event.get("pathParameters") or {}).get("token", "").strip()
        if not token:
            raise NotFoundError("Invite token is required.")

        org_repo = OrgDynamoRepository()
        # Verify the invite belongs to the caller's org before deleting —
        # prevents cross-tenant revocation via a handcrafted token.
        invite = org_repo.find_invite_by_token(token)
        if not invite:
            raise NotFoundError("Invite not found.")
        if invite.org_id != auth.org_id:
            raise AuthorizationError("Invite does not belong to your organization.")

        org_repo.delete_invite(auth.org_id, token)
        return build_success(204, {"deleted": True, "token": token})
    except Exception as e:
        return build_error(e)
