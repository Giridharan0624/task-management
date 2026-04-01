from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from domain.project.value_objects import ProjectRole


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
    project_id: str
    user_id: str
    project_role: ProjectRole
    added_by: Optional[str] = None
    joined_at: str

    @classmethod
    def create(
        cls,
        project_id: str,
        user_id: str,
        project_role: ProjectRole = ProjectRole.MEMBER,
        added_by: Optional[str] = None,
    ) -> "ProjectMember":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            project_id=project_id,
            user_id=user_id,
            project_role=project_role,
            added_by=added_by,
            joined_at=now,
        )

    def to_dict(self) -> dict:
        d = {
            "project_id": self.project_id,
            "user_id": self.user_id,
            "project_role": self.project_role.value,
            "joined_at": self.joined_at,
        }
        if self.added_by:
            d["added_by"] = self.added_by
        return d
