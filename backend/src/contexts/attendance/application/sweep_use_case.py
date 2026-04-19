"""Use case: close attendance sessions abandoned by the client.

The desktop app auto-signs-out on every termination path it can
observe (tray Quit, Wails OnShutdown, SIGTERM/SIGINT). It cannot
intercept force-kill scenarios — SIGKILL, Task Manager "End task",
power loss, OS crash — so those sessions would stay SIGNED_IN
forever without a backend sweeper.

Strategy:

    last proof-of-life = session.last_heartbeat_at
                         (stamped by POST /activity/heartbeat)
                       fall back to session.sign_in_at if no heartbeat
                       has arrived yet (session just started)

    if now - last proof-of-life > grace_minutes:
        close the session with sign_out_at = last proof-of-life
        (preserves accurate billable time; max leak = one heartbeat
         interval, ~5 min in practice)

The sweeper runs on an EventBridge schedule (see CDK stack). It
iterates every tenant in the table via OrgDynamoRepository.list_all_orgs,
then scans today + yesterday's attendance records per tenant (yesterday
catches sessions that crossed midnight). Failure in one tenant does
not affect the others — logged and tallied.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from contexts.attendance.domain.entities import IST, Attendance
from contexts.attendance.domain.repository import IAttendanceRepository

logger = logging.getLogger()


@dataclass
class SweepResult:
    """Per-sweep-run counters, returned to the Lambda invoker so
    CloudWatch can alarm on runaway closes (possible sweeper bug)
    and on zero-closes-ever (possible heartbeat-plumbing regression)."""

    orgs_processed: int = 0
    sessions_inspected: int = 0
    sessions_closed: int = 0
    errors: int = 0

    def as_dict(self) -> dict:
        return {
            "orgs_processed": self.orgs_processed,
            "sessions_inspected": self.sessions_inspected,
            "sessions_closed": self.sessions_closed,
            "errors": self.errors,
        }


class SweepStaleSessionsUseCase:
    """Per-tenant stale-session sweep. Stateless — constructed fresh
    per invocation. The repository is passed in so tests can use
    in-memory fakes."""

    def __init__(self, attendance_repo: IAttendanceRepository):
        self._repo = attendance_repo

    def execute(
        self,
        now: datetime,
        grace_minutes: int,
    ) -> SweepResult:
        """Sweep today + yesterday's attendance for stale sessions."""
        result = SweepResult()
        cutoff = now - timedelta(minutes=grace_minutes)

        for date in _dates_to_check(now):
            try:
                attendances = self._repo.find_all_by_date(date)
            except Exception as exc:
                logger.error("sweep: find_all_by_date(%s) failed: %s", date, exc)
                result.errors += 1
                continue

            for attendance in attendances:
                if not attendance.is_signed_in:
                    continue
                result.sessions_inspected += 1

                session = attendance.current_session
                assert session is not None  # guarded by is_signed_in
                last_alive = _last_proof_of_life(session)
                if last_alive > cutoff:
                    # Still within grace window — leave it alone.
                    continue

                try:
                    closed = attendance.sign_out(at=last_alive)
                    self._repo.save(closed)
                    result.sessions_closed += 1
                    logger.info(
                        "sweep: closed session user=%s date=%s sign_in=%s "
                        "last_alive=%s",
                        attendance.user_id,
                        attendance.date,
                        session.sign_in_at,
                        last_alive.isoformat(),
                    )
                except Exception as exc:
                    logger.error(
                        "sweep: close failed for user=%s date=%s: %s",
                        attendance.user_id,
                        attendance.date,
                        exc,
                    )
                    result.errors += 1

        return result


def _dates_to_check(now: datetime) -> Iterable[str]:
    """Return today + yesterday in IST (the timezone Attendance.date
    is written in). Yesterday catches sessions started before
    midnight that the user never closed — they're recorded under
    yesterday's date but still SIGNED_IN today."""
    ist_now = now.astimezone(IST)
    today = ist_now.strftime("%Y-%m-%d")
    yesterday = (ist_now - timedelta(days=1)).strftime("%Y-%m-%d")
    return [yesterday, today]


def _last_proof_of_life(session) -> datetime:
    """Most recent timestamp we have evidence the client was alive."""
    raw = session.last_heartbeat_at or session.sign_in_at
    parsed = datetime.fromisoformat(raw)
    # Handle naive-ISO edge case (should never happen given entities.py
    # always writes timezone-aware isoformat, but defensive).
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def sweep_attendance_for_attendance(
    attendance: Attendance,
    now: datetime,
    grace_minutes: int,
) -> Optional[Attendance]:
    """Pure function exposed for tests + one-off scripts.
    Returns a closed Attendance if the current session is stale,
    otherwise None. No repository side-effects.
    """
    if not attendance.is_signed_in:
        return None
    session = attendance.current_session
    if session is None:
        return None
    cutoff = now - timedelta(minutes=grace_minutes)
    last_alive = _last_proof_of_life(session)
    if last_alive > cutoff:
        return None
    return attendance.sign_out(at=last_alive)
