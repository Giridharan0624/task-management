"""POST /orgs/current/delete — owner-initiated soft-delete.

Marks the tenant PENDING_DELETION with a 30-day grace period. Every
mutation handler blocks via `require_not_suspended` from that moment
on (it now treats PENDING_DELETION the same as SUSPENDED).

The owner keeps read access + a visible "Recover workspace" affordance
during the grace window. After 30 days the nightly sweeper
(`hard_delete_sweeper`) physically removes every tenant-scoped row.

Confirmation: body must include the workspace slug verbatim. Typing
the slug is the typo guard; this is irreversible once the sweeper
runs.

Deliberately DOES NOT call `require_not_suspended` — an OWNER can
still re-confirm deletion (idempotent) on an already-pending tenant,
and suspension by a platform operator shouldn't trap them in a
workspace they can't leave.
"""
from __future__ import annotations

from pydantic import BaseModel

from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import (
    invalidate_role_cache,
    require,
    require_email_verified,
)
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class DeleteOrgRequest(BaseModel):
    confirm_slug: str  # must equal the org's slug verbatim


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        # OWNER-only, and also require the matching permission so a
        # future custom role can't grant workspace-deletion to anyone
        # but the OWNER.
        if (auth.role_id or auth.system_role).lower() != "owner":
            raise AuthorizationError(
                "Only the workspace owner can delete the workspace.",
            )
        # Highest-stakes action in the product — require the caller to
        # have proven they own their own email before letting them
        # schedule workspace-wide hard-deletion.
        require_email_verified(auth)
        require(auth, P.SETTINGS_EDIT)

        req = validate_body(DeleteOrgRequest, event.get("body"))
        confirm = req.confirm_slug.strip().lower()

        repo = OrgDynamoRepository()
        org = repo.find_by_id(auth.org_id)
        if not org:
            raise NotFoundError(f"Organization '{auth.org_id}' not found.")

        if confirm != org.slug.lower():
            raise ValidationError(
                f"Confirmation mismatch. Type the workspace slug "
                f"('{org.slug}') exactly to confirm deletion.",
            )

        # Idempotent — if already pending, return current state without
        # re-stamping deleted_at (preserves the original 30-day clock).
        if org.deleted_at:
            return build_success(200, {
                "org": org.to_dict(),
                "already_pending": True,
            })

        updated = org.mark_pending_deletion()
        repo.save(updated)
        # Drop any cached role permissions so warm Lambdas stop
        # surfacing features that are now gated by the new status.
        invalidate_role_cache(auth.org_id)

        audit.record(
            auth,
            action=audit.ORG_DELETED,
            target={"type": "org", "id": auth.org_id},
            summary=(
                f"Workspace '{org.slug}' scheduled for deletion "
                f"(30-day grace period)"
            ),
            before={"status": org.status.value, "deleted_at": None},
            after={
                "status": updated.status.value,
                "deleted_at": updated.deleted_at,
            },
        )
        return build_success(200, {"org": updated.to_dict()})
    except Exception as e:
        return build_error(e)
