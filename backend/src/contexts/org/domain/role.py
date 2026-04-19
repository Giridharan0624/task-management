"""Phase 4 — `Role` aggregate.

A role belongs to one org and carries the set of permission strings the
holder is allowed to perform. System roles (OWNER/ADMIN/MEMBER) are
seeded at org creation and cannot be deleted; tenants may create
additional custom roles.
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

# Allowed values for `Role.scope`. "system" roles apply org-wide;
# "project" roles only matter inside a project membership context.
RoleScope = str  # Literal["system", "project"]  — kept loose for now


class Role(BaseModel):
    org_id: str
    role_id: str
    name: str
    scope: RoleScope = "system"
    is_system: bool = False  # if True, the role cannot be deleted
    permissions: set[str] = Field(default_factory=set)
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        org_id: str,
        role_id: str,
        name: str,
        permissions: set[str],
        scope: RoleScope = "system",
        is_system: bool = False,
    ) -> "Role":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            org_id=org_id,
            role_id=role_id,
            name=name,
            scope=scope,
            is_system=is_system,
            permissions=permissions,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "role_id": self.role_id,
            "name": self.name,
            "scope": self.scope,
            "is_system": self.is_system,
            "permissions": sorted(self.permissions),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def has(self, permission: str) -> bool:
        return permission in self.permissions
