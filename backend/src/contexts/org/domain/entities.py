from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from contexts.org.domain.value_objects import OrgStatus, PlanTier


class Organization(BaseModel):
    org_id: str
    slug: str
    name: str
    owner_user_id: str
    status: OrgStatus = OrgStatus.ACTIVE
    plan_tier: PlanTier = PlanTier.FREE
    created_at: str
    updated_at: str
    # Set when the owner initiates deletion. 30 days after this
    # timestamp the nightly sweeper hard-deletes every tenant-scoped
    # row. Cleared by `reactivate()` during the grace period.
    deleted_at: Optional[str] = None

    @classmethod
    def create(
        cls,
        org_id: str,
        slug: str,
        name: str,
        owner_user_id: str,
        plan_tier: PlanTier = PlanTier.FREE,
    ) -> "Organization":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            org_id=org_id,
            slug=slug,
            name=name,
            owner_user_id=owner_user_id,
            plan_tier=plan_tier,
            created_at=now,
            updated_at=now,
        )

    def suspend(self) -> "Organization":
        return self.model_copy(update={
            "status": OrgStatus.SUSPENDED,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    def reactivate(self) -> "Organization":
        """Return an ACTIVE copy. Also clears `deleted_at` so an
        owner-initiated undelete fully reverses the prior delete."""
        return self.model_copy(update={
            "status": OrgStatus.ACTIVE,
            "deleted_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    def mark_pending_deletion(self) -> "Organization":
        """Owner-initiated soft-delete. Sets `deleted_at` so the sweeper
        can hard-delete 30 days from now. Keeps the ORG record around
        so the undelete path can restore without losing anything."""
        now = datetime.now(timezone.utc).isoformat()
        return self.model_copy(update={
            "status": OrgStatus.PENDING_DELETION,
            "deleted_at": now,
            "updated_at": now,
        })

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "slug": self.slug,
            "name": self.name,
            "owner_user_id": self.owner_user_id,
            "status": self.status.value,
            "plan_tier": self.plan_tier.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "deleted_at": self.deleted_at,
        }


class OrgSettings(BaseModel):
    """Per-organization configuration. One JSON doc per org."""
    org_id: str
    display_name: str
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#4F46E5"
    accent_color: str = "#10B981"
    terminology: dict[str, str] = {}
    timezone: str = "Asia/Kolkata"
    locale: str = "en-IN"
    currency: str = "INR"
    week_start_day: int = 1
    working_hours_start: str = "09:00"
    working_hours_end: str = "18:00"
    employee_id_prefix: str = "EMP-"
    features: dict[str, bool] = {
        "birthday_wishes": True,
        "activity_monitoring": True,
        "screenshots": False,
        "ai_summaries": True,
        "day_offs": True,
        "comments": True,
        "task_updates": True,
    }
    leave_types: list[dict] = [
        {"id": "casual", "name": "Casual", "annual_quota": 12},
        {"id": "sick", "name": "Sick", "annual_quota": 10},
        {"id": "earned", "name": "Earned", "annual_quota": 15},
    ]
    created_at: str
    updated_at: str

    @classmethod
    def create_default(cls, org_id: str, display_name: str) -> "OrgSettings":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            org_id=org_id,
            display_name=display_name,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return self.model_dump()


class Plan(BaseModel):
    org_id: str
    tier: PlanTier
    max_users: Optional[int] = None
    max_projects: Optional[int] = None
    retention_days: Optional[int] = None
    features_allowed: set[str] = set()
    created_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "tier": self.tier.value,
            "max_users": self.max_users,
            "max_projects": self.max_projects,
            "retention_days": self.retention_days,
            "features_allowed": sorted(self.features_allowed),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class Invite(BaseModel):
    org_id: str
    token: str
    email: str
    role_id: str
    invited_by: str
    expires_at: str
    accepted_at: Optional[str] = None
    created_at: str

    @classmethod
    def create(
        cls,
        org_id: str,
        token: str,
        email: str,
        role_id: str,
        invited_by: str,
        expires_at: str,
    ) -> "Invite":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            org_id=org_id,
            token=token,
            email=email,
            role_id=role_id,
            invited_by=invited_by,
            expires_at=expires_at,
            created_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "token": self.token,
            "email": self.email,
            "role_id": self.role_id,
            "invited_by": self.invited_by,
            "expires_at": self.expires_at,
            "accepted_at": self.accepted_at,
            "created_at": self.created_at,
        }
