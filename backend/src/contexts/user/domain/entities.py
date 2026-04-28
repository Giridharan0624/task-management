from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Union

from pydantic import BaseModel, field_validator

from contexts.user.domain.value_objects import SystemRole


class User(BaseModel):
    user_id: str
    employee_id: Optional[str] = None
    email: str
    name: str
    # system_role is the user's assigned role_id. Historically this was
    # constrained to the SystemRole enum (OWNER/ADMIN/MEMBER); Session 8
    # relaxed it to accept any role_id that exists as a scope="system"
    # record in the org's role table, so tenants can assign users to
    # custom roles they've defined in /settings/roles.
    #
    # Stored canonical form: uppercase for the three built-in tiers
    # (OWNER, ADMIN, MEMBER) for backward compatibility with existing
    # DDB items and Cognito `custom:systemRole`; lowercase for custom
    # role_ids (matching the role_id convention in default_roles.py).
    # Permission resolution uses a case-insensitive match against DDB
    # role records, so both forms work.
    system_role: str
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
    company_prefix: Optional[str] = None
    # First-login guided tour completion flag. False until the user
    # finishes or skips the in-app walkthrough; setting it server-side
    # (instead of localStorage-only) means the tour stays dismissed
    # across browsers, devices, and incognito sessions.
    walkthrough_seen: bool = False
    created_at: str
    updated_at: str

    @field_validator("system_role", mode="before")
    @classmethod
    def _coerce_system_role(cls, v):
        # Accept SystemRole enum members, raw strings from DDB/Cognito,
        # or anything the old Pydantic-enum field accepted. Empty/None
        # collapses to MEMBER so a corrupt DDB item doesn't blow up the
        # mapper on load.
        if v is None or v == "":
            return SystemRole.MEMBER.value
        if isinstance(v, SystemRole):
            return v.value
        return str(v)

    @classmethod
    def create(
        cls,
        user_id: str,
        email: str,
        name: str,
        system_role: Union[SystemRole, str] = SystemRole.MEMBER,
        created_by: Optional[str] = None,
        employee_id: Optional[str] = None,
    ) -> "User":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            user_id=user_id,
            employee_id=employee_id,
            email=email,
            name=name,
            system_role=system_role.value if isinstance(system_role, SystemRole) else system_role,
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
            "system_role": self.system_role,
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
            "company_prefix": self.company_prefix,
            "walkthrough_seen": self.walkthrough_seen,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
