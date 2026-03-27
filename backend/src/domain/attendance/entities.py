from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel


class Session(BaseModel):
    sign_in_at: str
    sign_out_at: Optional[str] = None
    hours: Optional[float] = None


class Attendance(BaseModel):
    user_id: str
    date: str
    sessions: list[Session] = []
    total_hours: float = 0.0
    user_name: str
    user_email: str
    system_role: str

    @classmethod
    def create(
        cls,
        user_id: str,
        user_name: str,
        user_email: str,
        system_role: str,
    ) -> "Attendance":
        now = datetime.now(timezone.utc)
        session = Session(sign_in_at=now.isoformat())
        return cls(
            user_id=user_id,
            date=now.strftime("%Y-%m-%d"),
            sessions=[session],
            total_hours=0.0,
            user_name=user_name,
            user_email=user_email,
            system_role=system_role,
        )

    @property
    def is_signed_in(self) -> bool:
        return len(self.sessions) > 0 and self.sessions[-1].sign_out_at is None

    @property
    def current_session(self) -> Optional[Session]:
        if self.sessions and self.sessions[-1].sign_out_at is None:
            return self.sessions[-1]
        return None

    def sign_in(self) -> "Attendance":
        now = datetime.now(timezone.utc)
        new_session = Session(sign_in_at=now.isoformat())
        return Attendance(
            user_id=self.user_id,
            date=self.date,
            sessions=[*self.sessions, new_session],
            total_hours=self.total_hours,
            user_name=self.user_name,
            user_email=self.user_email,
            system_role=self.system_role,
        )

    def sign_out(self) -> "Attendance":
        now = datetime.now(timezone.utc)
        if not self.is_signed_in:
            return self

        last = self.sessions[-1]
        sign_in = datetime.fromisoformat(last.sign_in_at)
        session_hours = round((now - sign_in).total_seconds() / 3600, 2)

        closed_session = Session(
            sign_in_at=last.sign_in_at,
            sign_out_at=now.isoformat(),
            hours=session_hours,
        )

        updated_sessions = [*self.sessions[:-1], closed_session]
        new_total = round(self.total_hours + session_hours, 2)

        return Attendance(
            user_id=self.user_id,
            date=self.date,
            sessions=updated_sessions,
            total_hours=new_total,
            user_name=self.user_name,
            user_email=self.user_email,
            system_role=self.system_role,
        )

    def to_dict(self) -> dict:
        current = self.current_session
        return {
            "user_id": self.user_id,
            "date": self.date,
            "sessions": [
                {
                    "sign_in_at": s.sign_in_at,
                    "sign_out_at": s.sign_out_at,
                    "hours": s.hours,
                }
                for s in self.sessions
            ],
            "total_hours": self.total_hours,
            "current_sign_in_at": current.sign_in_at if current else None,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "system_role": self.system_role,
            "status": "SIGNED_IN" if self.is_signed_in else "SIGNED_OUT",
            "session_count": len(self.sessions),
        }
