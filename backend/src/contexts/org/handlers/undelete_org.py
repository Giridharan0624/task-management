"""POST /orgs/current/undelete — owner reverses a pending deletion.

Callable only during the 30-day grace period (sweeper hard-deletes
after that). Resets status=ACTIVE and clears `deleted_at`, unblocking
every mutation handler that was gated by the PENDING_DELETION status.

Deliberately DOES NOT call `require_not_suspended` — if we did, the
owner couldn't recover a deletion (the very status we're trying to
clear would block the call).
"""
from __future__ import annotations

from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.org.domain.value_objects import OrgStatus
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import invalidate_role_cache, require
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        if (auth.role_id or auth.system_role).lower() != "owner":
            raise AuthorizationError(
                "Only the workspace owner can recover the workspace.",
            )
        require(auth, P.SETTINGS_EDIT)

        repo = OrgDynamoRepository()
        org = repo.find_by_id(auth.org_id)
        if not org:
            raise NotFoundError(f"Organization '{auth.org_id}' not found.")

        if org.status != OrgStatus.PENDING_DELETION or not org.deleted_at:
            raise ValidationError(
                "Workspace is not scheduled for deletion — nothing to recover.",
            )

        updated = org.reactivate()
        repo.save(updated)
        invalidate_role_cache(auth.org_id)

        audit.record(
            auth,
            action=audit.ORG_RESUMED,
            target={"type": "org", "id": auth.org_id},
            summary=f"Workspace '{org.slug}' deletion canceled — restored to ACTIVE",
            before={
                "status": org.status.value,
                "deleted_at": org.deleted_at,
            },
            after={"status": updated.status.value, "deleted_at": None},
        )
        return build_success(200, {"org": updated.to_dict()})
    except Exception as e:
        return build_error(e)
