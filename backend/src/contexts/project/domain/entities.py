from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from contexts.org.domain.default_project_roles import (
    PROJECT_MEMBER_ROLE_ID,
    normalize_project_role_id,
)


class Project(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    domain: str = "DEVELOPMENT"
    created_by: str
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        project_id: str,
        name: str,
        created_by: str,
        description: Optional[str] = None,
        estimated_hours: Optional[float] = None,
        domain: str = "DEVELOPMENT",
    ) -> "Project":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            project_id=project_id,
            name=name,
            description=description,
            estimated_hours=estimated_hours,
            domain=domain,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "project_id": self.project_id,
            "name": self.name,
            "description": self.description,
            "estimated_hours": self.estimated_hours,
            "domain": self.domain,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class ProjectMember(BaseModel):
    """Represents one user's role on a project.

    `project_role_id` replaces the pre-refactor `project_role` enum
    (ADMIN / PROJECT_MANAGER / TEAM_LEAD / MEMBER). The ID is the
    lowercase prefixed form (project_admin / project_manager /
    team_lead / project_member) stored as a per-org Role record with
    `scope='project'`. Tenants can create custom project roles and
    assign them here — the ID is just a string, not an enum.
    """
    project_id: str
    user_id: str
    project_role_id: str = PROJECT_MEMBER_ROLE_ID
    added_by: Optional[str] = None
    joined_at: str

    @classmethod
    def create(
        cls,
        project_id: str,
        user_id: str,
        project_role_id: str = PROJECT_MEMBER_ROLE_ID,
        added_by: Optional[str] = None,
    ) -> "ProjectMember":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            project_id=project_id,
            user_id=user_id,
            project_role_id=normalize_project_role_id(project_role_id),
            added_by=added_by,
            joined_at=now,
        )

    def to_dict(self) -> dict:
        # Emit both keys so legacy clients that read `project_role`
        # (the enum-value string) keep working during the refactor.
        # `project_role_id` is the canonical post-refactor field.
        d = {
            "project_id": self.project_id,
            "user_id": self.user_id,
            "project_role_id": self.project_role_id,
            "project_role": _LEGACY_ENUM_FOR_ROLE_ID.get(
                self.project_role_id, self.project_role_id.upper(),
            ),
            "joined_at": self.joined_at,
        }
        if self.added_by:
            d["added_by"] = self.added_by
        return d


# Inverse of LEGACY_PROJECT_ROLE_TO_ID — projects the canonical role_id
# back onto the legacy uppercase enum value so existing frontend code
# that reads `project_role` gets the shape it expects. Custom tenant
# role IDs fall through to an uppercased form of the ID itself.
_LEGACY_ENUM_FOR_ROLE_ID: dict[str, str] = {
    "project_admin": "ADMIN",
    "project_manager": "PROJECT_MANAGER",
    "team_lead": "TEAM_LEAD",
    "project_member": "MEMBER",
}
