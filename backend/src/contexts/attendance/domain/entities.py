from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from pydantic import BaseModel

IST = timezone(timedelta(hours=5, minutes=30))


class Session(BaseModel):
    sign_in_at: str
    sign_out_at: Optional[str] = None
    hours: Optional[float] = None
    task_id: Optional[str] = None
    project_id: Optional[str] = None
    task_title: Optional[str] = None
    project_name: Optional[str] = None
    description: Optional[str] = None
    # last_heartbeat_at is stamped by POST /activity/heartbeat on every
    # heartbeat the desktop client sends. When a session is abandoned
    # (force-kill, power cut) no further heartbeats arrive and the
    # sweep lambda can close the session with sign_out_at set to this
    # value — the user's billable time ends at the last proof-of-life,
    # not at sweep time.
    last_heartbeat_at: Optional[str] = None


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
        task_id: Optional[str] = None,
        project_id: Optional[str] = None,
        task_title: Optional[str] = None,
        project_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> "Attendance":
        now = datetime.now(timezone.utc)
        session = Session(
            sign_in_at=now.isoformat(),
            task_id=task_id,
            project_id=project_id,
            task_title=task_title,
            project_name=project_name,
            description=description,
        )
        return cls(
            user_id=user_id,
            date=now.astimezone(IST).strftime("%Y-%m-%d"),
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

    def sign_in(
        self,
        task_id: Optional[str] = None,
        project_id: Optional[str] = None,
        task_title: Optional[str] = None,
        project_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> "Attendance":
        now = datetime.now(timezone.utc)
        new_session = Session(
            sign_in_at=now.isoformat(),
            task_id=task_id,
            project_id=project_id,
            task_title=task_title,
            project_name=project_name,
            description=description,
        )
        return Attendance(
            user_id=self.user_id,
            date=self.date,
            sessions=[*self.sessions, new_session],
            total_hours=self.total_hours,
            user_name=self.user_name,
            user_email=self.user_email,
            system_role=self.system_role,
        )

    def sign_out(self, at: Optional[datetime] = None) -> "Attendance":
        """Close the current session.

        ``at`` defaults to ``datetime.now(utc)`` for the normal
        user-initiated sign-out path. The sweep lambda passes the
        session's ``last_heartbeat_at`` so an abandoned session's
        billable time ends at the last proof-of-life moment, not at
        sweep time.
        """
        close_time = at if at is not None else datetime.now(timezone.utc)
        if not self.is_signed_in:
            return self

        last = self.sessions[-1]
        sign_in = datetime.fromisoformat(last.sign_in_at)
        # Guard against a sweep that somehow receives a close_time
        # BEFORE sign_in_at (clock skew, corrupted heartbeat). Clamp
        # to sign_in_at so we never write a negative-duration session.
        if close_time < sign_in:
            close_time = sign_in
        session_hours = round((close_time - sign_in).total_seconds() / 3600, 4)

        closed_session = Session(
            sign_in_at=last.sign_in_at,
            sign_out_at=close_time.isoformat(),
            hours=session_hours,
            task_id=last.task_id,
            project_id=last.project_id,
            task_title=last.task_title,
            project_name=last.project_name,
            description=last.description,
            last_heartbeat_at=last.last_heartbeat_at,
        )

        updated_sessions = [*self.sessions[:-1], closed_session]
        new_total = round(self.total_hours + session_hours, 4)

        return Attendance(
            user_id=self.user_id,
            date=self.date,
            sessions=updated_sessions,
            total_hours=new_total,
            user_name=self.user_name,
            user_email=self.user_email,
            system_role=self.system_role,
        )

    def record_heartbeat(self, at: datetime) -> "Attendance":
        """Stamp the current session with a fresh heartbeat timestamp.

        No-op if there is no active session (the heartbeat handler
        guards against this too, but domain-level defence is cheap
        and keeps the invariant "last_heartbeat_at only on an open
        session" explicit). See sweep_stale_sessions.
        """
        if not self.is_signed_in:
            return self
        last = self.sessions[-1]
        stamped = Session(
            sign_in_at=last.sign_in_at,
            sign_out_at=last.sign_out_at,
            hours=last.hours,
            task_id=last.task_id,
            project_id=last.project_id,
            task_title=last.task_title,
            project_name=last.project_name,
            description=last.description,
            last_heartbeat_at=at.isoformat(),
        )
        return Attendance(
            user_id=self.user_id,
            date=self.date,
            sessions=[*self.sessions[:-1], stamped],
            total_hours=self.total_hours,
            user_name=self.user_name,
            user_email=self.user_email,
            system_role=self.system_role,
        )

    def to_dict(self) -> dict:
        current = self.current_session
        current_task = None
        if current and current.task_id:
            current_task = {
                "task_id": current.task_id,
                "project_id": current.project_id,
                "task_title": current.task_title,
                "project_name": current.project_name,
            }

        return {
            "user_id": self.user_id,
            "date": self.date,
            "sessions": [
                {
                    "sign_in_at": s.sign_in_at,
                    "sign_out_at": s.sign_out_at,
                    "hours": s.hours,
                    "task_id": s.task_id,
                    "project_id": s.project_id,
                    "task_title": s.task_title,
                    "project_name": s.project_name,
                    "description": s.description,
                    "last_heartbeat_at": s.last_heartbeat_at,
                }
                for s in self.sessions
            ],
            "total_hours": self.total_hours,
            "current_sign_in_at": current.sign_in_at if current else None,
            "current_task": current_task,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "system_role": self.system_role,
            "status": "SIGNED_IN" if self.is_signed_in else "SIGNED_OUT",
            "session_count": len(self.sessions),
            # Server-authoritative UTC timestamp at the moment this
            # response is built. Clients use it as a clock reference —
            # they record `offset = server_time - client_now_at_receive`
            # and drive the Timer from `Date.now() + offset` instead of
            # `Date.now()` directly. This immunizes cross-device display
            # against OS clock drift (if device A's clock is 30 s off
            # NTP and B's is synced, their timers still agree on
            # elapsed time because both tick relative to the server).
            #
            # Non-breaking: a client that ignores this field continues
            # to work exactly as before, just without the clock-drift
            # correction.
            "server_time": datetime.now(timezone.utc).isoformat(),
        }
