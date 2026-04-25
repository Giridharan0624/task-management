"""POST /orgs/current/roles — create a custom role.

Gated on `role.manage`. The role_id is server-derived from the name (slug
form) so a tenant cannot accidentally collide with system role IDs
(owner/admin/member). Permissions list is intersected with the global
permission catalog so an attacker cannot inject arbitrary strings.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import ValidationError
from shared_kernel.permissions import (
    invalidate_role_cache,
    require,
    require_not_suspended,
)
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


# Reserved role IDs (lowercase). A tenant cannot create a role with these
# IDs — they would shadow the system roles seeded at signup.
RESERVED_IDS = {"owner", "admin", "member"}

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    s = _SLUG_RE.sub("_", name.strip().lower()).strip("_")
    return s[:32]


class CreateRoleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    permissions: list[str] = Field(default_factory=list)
    scope: Optional[str] = "system"


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # NOTE: email-verified gate intentionally omitted here. Role
        # mutations are an internal admin workflow and the action is
        # already gated on ROLE_MANAGE; requiring email verification
        # in addition was blocking OWNERs whose verification claim
        # hadn't propagated. Sensitive cross-account actions (invite,
        # transfer-ownership, delete-org, settings) keep the gate.
        require(auth, P.ROLE_MANAGE)

        req = validate_body(CreateRoleRequest, event.get("body"))
        role_id = _slugify(req.name)
        if not role_id:
            raise ValidationError("Role name must contain alphanumeric characters.")
        if role_id in RESERVED_IDS:
            raise ValidationError(
                f"'{role_id}' is reserved — pick a different role name."
            )

        repo = OrgDynamoRepository()
        if repo.get_role(auth.org_id, role_id) is not None:
            raise ValidationError(f"A role with id '{role_id}' already exists.")

        # Intersect with the global catalog: silently drop unknown
        # permission strings so a stale frontend cannot corrupt the role
        # record. The frontend can validate up-front against the same
        # catalog from GET /orgs/current/roles.
        clean_perms = sorted(set(req.permissions) & P.ALL_PERMISSIONS)

        now = datetime.now(timezone.utc).isoformat()
        role = {
            "org_id": auth.org_id,
            "role_id": role_id,
            "name": req.name.strip(),
            "scope": req.scope or "system",
            "is_system": False,
            "permissions": clean_perms,
            "created_at": now,
            "updated_at": now,
        }
        repo.save_role(role)
        invalidate_role_cache(auth.org_id)
        audit.record(
            auth,
            action=audit.ROLE_CREATED,
            target={"type": "role", "id": role_id},
            summary=f"Created role '{req.name}' with {len(clean_perms)} permission(s)",
            after=role,
        )
        return build_success(201, role)
    except Exception as e:
        return build_error(e)
