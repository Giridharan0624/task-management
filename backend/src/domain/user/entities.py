from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from domain.user.value_objects import SystemRole


class User(BaseModel):
    user_id: str
    employee_id: Optional[str] = None
    email: str
    name: str
    system_role: SystemRole
    created_by: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    skills: list[str] = []
    date_of_birth: Optional[str] = None
    college_name: Optional[str] = None
    area_of_interest: Optional[str] = None
    hobby: Optional[str] = None
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
        employee_id: Optional[str] = None,
    ) -> "User":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            user_id=user_id,
            employee_id=employee_id,
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
            "employee_id": self.employee_id,
            "email": self.email,
            "name": self.name,
            "system_role": self.system_role.value,
            "created_by": self.created_by,
            "phone": self.phone,
            "designation": self.designation,
            "department": self.department,
            "location": self.location,
            "bio": self.bio,
            "avatar_url": self.avatar_url,
            "skills": self.skills,
            "date_of_birth": self.date_of_birth,
            "college_name": self.college_name,
            "area_of_interest": self.area_of_interest,
            "hobby": self.hobby,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
