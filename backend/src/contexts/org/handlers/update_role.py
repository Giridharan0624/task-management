"""PUT /orgs/current/roles/{roleId} — update a role's name or permissions.

System roles (owner/admin/member) accept permission edits but their name
and is_system flag are locked — preserves the legacy mapping that
existing JWT claims and handler code rely on.
"""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import (
    invalidate_role_cache,
    require,
    require_not_suspended,
)
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    permissions: Optional[list[str]] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # Email-verified gate intentionally omitted — see create_role.py.
        require(auth, P.ROLE_MANAGE)

        path = event.get("pathParameters") or {}
        role_id = (path.get("roleId") or "").strip().lower()
        if not role_id:
            raise ValidationError("roleId is required in the path.")

        repo = OrgDynamoRepository()
        existing = repo.get_role(auth.org_id, role_id)
        if existing is None:
            raise NotFoundError("Role not found.")

        req = validate_body(UpdateRoleRequest, event.get("body"))

        updated = dict(existing)
        if req.name is not None and not existing["is_system"]:
            updated["name"] = req.name.strip()
        if req.permissions is not None:
            # Same intersection rule as create — silently drop unknown
            # permissions rather than 400ing on stale frontends.
            updated["permissions"] = sorted(
                set(req.permissions) & P.ALL_PERMISSIONS
            )
        updated["updated_at"] = datetime.now(timezone.utc).isoformat()

        repo.save_role(updated)
        invalidate_role_cache(auth.org_id)
        audit.record(
            auth,
            action=audit.ROLE_UPDATED,
            target={"type": "role", "id": role_id},
            summary=f"Edited role '{updated['name']}'",
            before=existing,
            after=updated,
        )
        return build_success(200, updated)
    except Exception as e:
        return build_error(e)
