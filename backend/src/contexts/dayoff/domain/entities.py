from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel


class DayOffRequest(BaseModel):
    request_id: str
    user_id: str
    user_name: str
    employee_id: Optional[str] = None
    start_date: str
    end_date: str
    reason: str
    status: str = "PENDING"
    team_lead_id: Optional[str] = None
    team_lead_name: Optional[str] = None
    team_lead_status: str = "N/A"
    admin_id: str = ""
    admin_name: Optional[str] = None
    admin_status: str = "PENDING"
    forwarded_to: Optional[str] = None
    forwarded_to_name: Optional[str] = None
    forwarded_by: Optional[str] = None
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        request_id: str,
        user_id: str,
        user_name: str,
        employee_id: Optional[str],
        start_date: str,
        end_date: str,
        reason: str,
        admin_id: str,
        admin_name: Optional[str],
        team_lead_id: Optional[str] = None,
        team_lead_name: Optional[str] = None,
    ) -> DayOffRequest:
        now = datetime.now(timezone.utc).isoformat()
        tl_status = "PENDING" if team_lead_id else "N/A"
        return cls(
            request_id=request_id,
            user_id=user_id,
            user_name=user_name,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            admin_id=admin_id,
            admin_name=admin_name,
            team_lead_id=team_lead_id,
            team_lead_name=team_lead_name,
            team_lead_status=tl_status,
            created_at=now,
            updated_at=now,
        )

    def compute_status(self) -> str:
        if self.admin_status == "REJECTED" or self.team_lead_status == "REJECTED":
            return "REJECTED"
        if self.admin_status == "APPROVED" and (
            self.team_lead_status == "APPROVED" or self.team_lead_status == "N/A"
        ):
            return "APPROVED"
        return "PENDING"

    def to_dict(self) -> dict:
        return {
            "request_id": self.request_id,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "employee_id": self.employee_id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "reason": self.reason,
            "status": self.status,
            "team_lead_id": self.team_lead_id,
            "team_lead_name": self.team_lead_name,
            "team_lead_status": self.team_lead_status,
            "admin_id": self.admin_id,
            "admin_name": self.admin_name,
            "admin_status": self.admin_status,
            "forwarded_to": self.forwarded_to,
            "forwarded_to_name": self.forwarded_to_name,
            "forwarded_by": self.forwarded_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
