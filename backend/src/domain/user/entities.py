from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from domain.user.value_objects import SystemRole


class User(BaseModel):
    user_id: str
    email: str
    name: str
    system_role: SystemRole
    created_by: Optional[str] = None
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        user_id: str,
        email: str,
        name: str,
        system_role: SystemRole = SystemRole.MEMBER,
        created_by: Optional[str] = None,
    ) -> "User":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            user_id=user_id,
            email=email,
            name=name,
            system_role=system_role,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "name": self.name,
            "system_role": self.system_role.value,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
