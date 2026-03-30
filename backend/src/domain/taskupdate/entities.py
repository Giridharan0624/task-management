from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel


class TaskSummaryItem(BaseModel):
    task_name: str
    time_recorded: str  # e.g. "2.5h" or "1h 30m"


class TaskUpdate(BaseModel):
    update_id: str
    user_id: str
    user_name: str
    employee_id: Optional[str] = None
    date: str  # YYYY-MM-DD
    sign_in: str  # first sign-in time of the day
    sign_out: str  # last sign-out time of the day
    task_summary: list[TaskSummaryItem]
    total_time: str  # e.g. "8.5h"
    created_at: str

    @classmethod
    def create(
        cls,
        user_id: str,
        user_name: str,
        date: str,
        sign_in: str,
        sign_out: str,
        task_summary: list[dict],
        total_time: str,
        employee_id: Optional[str] = None,
    ) -> TaskUpdate:
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            update_id=str(uuid.uuid4()),
            user_id=user_id,
            user_name=user_name,
            employee_id=employee_id,
            date=date,
            sign_in=sign_in,
            sign_out=sign_out,
            task_summary=[TaskSummaryItem(**item) for item in task_summary],
            total_time=total_time,
            created_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "update_id": self.update_id,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "employee_id": self.employee_id,
            "date": self.date,
            "sign_in": self.sign_in,
            "sign_out": self.sign_out,
            "task_summary": [{"task_name": t.task_name, "time_recorded": t.time_recorded} for t in self.task_summary],
            "total_time": self.total_time,
            "created_at": self.created_at,
        }
