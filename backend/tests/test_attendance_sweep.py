"""Unit tests for the stale-session sweep.

Tests both the pure-function detection logic and the use case that
orchestrates tenant scans. The Lambda handler itself is thin glue
(orgs iteration + env var parsing) and has no tests — exercising it
would require moto/boto3 plumbing for marginal value.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest

from contexts.attendance.application.sweep_use_case import (
    SweepStaleSessionsUseCase,
    sweep_attendance_for_attendance,
)
from contexts.attendance.domain.entities import IST, Attendance, Session
from contexts.attendance.domain.repository import IAttendanceRepository


# ── fixtures ──────────────────────────────────────────────────────────


def _att(
    user_id: str = "u1",
    date: str = "2026-05-01",
    sign_in_at: Optional[datetime] = None,
    sign_out_at: Optional[datetime] = None,
    last_heartbeat_at: Optional[datetime] = None,
) -> Attendance:
    """Build an Attendance with one session for tests. Deliberately
    bypasses the normal .create constructor (which uses now()) so
    tests can fix exact timestamps."""
    if sign_in_at is None:
        sign_in_at = datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc)
    session = Session(
        sign_in_at=sign_in_at.isoformat(),
        sign_out_at=sign_out_at.isoformat() if sign_out_at else None,
        last_heartbeat_at=(
            last_heartbeat_at.isoformat() if last_heartbeat_at else None
        ),
    )
    return Attendance(
        user_id=user_id,
        date=date,
        sessions=[session],
        total_hours=0.0,
        user_name="Tester",
        user_email="t@example.com",
        system_role="MEMBER",
    )


class _FakeRepo(IAttendanceRepository):
    """Minimal in-memory repo. Only implements the methods the
    sweeper calls; the rest raise so a test that hits them fails
    loudly instead of silently."""

    def __init__(self, records_by_date: dict[str, list[Attendance]]):
        self._by_date = records_by_date
        self.saved: list[Attendance] = []

    def find_all_by_date(self, date: str) -> list[Attendance]:
        return list(self._by_date.get(date, []))

    def save(self, attendance: Attendance) -> None:
        self.saved.append(attendance)

    def find_by_user_and_date(self, user_id, date):  # pragma: no cover
        raise NotImplementedError

    def find_all_by_date_range(self, start, end):  # pragma: no cover
        raise NotImplementedError


# ── sweep_attendance_for_attendance (pure) ────────────────────────────


def test_no_close_if_not_signed_in():
    closed_at = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    att = _att(
        sign_in_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
        sign_out_at=closed_at,
    )
    result = sweep_attendance_for_attendance(
        att,
        now=datetime(2026, 5, 1, 20, 0, tzinfo=timezone.utc),
        grace_minutes=15,
    )
    assert result is None


def test_no_close_within_grace_via_heartbeat():
    now = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    att = _att(
        sign_in_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
        # 3 minutes ago — well within a 15-min grace window.
        last_heartbeat_at=now - timedelta(minutes=3),
    )
    assert sweep_attendance_for_attendance(att, now=now, grace_minutes=15) is None


def test_no_close_within_grace_via_sign_in_when_no_heartbeat():
    now = datetime(2026, 5, 1, 9, 4, tzinfo=timezone.utc)
    # Session just opened 4 min ago, no heartbeat yet (desktop just
    # started, haven't ticked the 5-min heartbeat). Grace is 15,
    # so we have 11 min headroom.
    att = _att(sign_in_at=now - timedelta(minutes=4))
    assert sweep_attendance_for_attendance(att, now=now, grace_minutes=15) is None


def test_closes_when_heartbeat_is_stale():
    now = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    stale_hb = now - timedelta(minutes=20)  # 5 past the 15-min grace
    att = _att(
        sign_in_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
        last_heartbeat_at=stale_hb,
    )
    closed = sweep_attendance_for_attendance(att, now=now, grace_minutes=15)
    assert closed is not None
    # sign_out_at must match the last-alive timestamp, NOT now.
    assert closed.sessions[-1].sign_out_at == stale_hb.isoformat()
    # Hours reflect last_heartbeat_at - sign_in_at. sign_in=9:00,
    # last_heartbeat=9:40 (now=10:00 minus 20 min grace overrun) ⇒ 40 min.
    assert closed.total_hours == pytest.approx(40 / 60, rel=1e-3)
    assert not closed.is_signed_in


def test_closes_when_sign_in_is_stale_and_no_heartbeat():
    # Session opened 30 min ago, client died before even sending its
    # first heartbeat. Sweep should close at sign_in_at so the user
    # isn't billed for the silent window.
    now = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    sign_in = now - timedelta(minutes=30)
    att = _att(sign_in_at=sign_in)
    closed = sweep_attendance_for_attendance(att, now=now, grace_minutes=15)
    assert closed is not None
    assert closed.sessions[-1].sign_out_at == sign_in.isoformat()
    # Zero hours because sign_out == sign_in.
    assert closed.total_hours == 0.0


def test_clock_skew_past_future_close_time_clamped():
    # Pathological input: heartbeat timestamp is BEFORE sign_in_at
    # (clock jump / corrupted data). Without clamping, Attendance.sign_out
    # would produce a negative-duration session. Clamp to sign_in_at.
    now = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    sign_in = datetime(2026, 5, 1, 9, 30, tzinfo=timezone.utc)
    bogus_hb = datetime(2026, 5, 1, 8, 0, tzinfo=timezone.utc)  # before sign-in
    att = _att(sign_in_at=sign_in, last_heartbeat_at=bogus_hb)
    closed = sweep_attendance_for_attendance(att, now=now, grace_minutes=15)
    assert closed is not None
    # sign_out_at clamped up to sign_in_at → 0 duration, not negative.
    assert closed.total_hours >= 0.0
    assert closed.sessions[-1].sign_out_at == sign_in.isoformat()


# ── record_heartbeat domain method ────────────────────────────────────


def test_record_heartbeat_updates_current_session_only():
    sign_in = datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc)
    att = _att(sign_in_at=sign_in)
    hb_at = datetime(2026, 5, 1, 9, 5, tzinfo=timezone.utc)
    stamped = att.record_heartbeat(hb_at)
    assert stamped.sessions[-1].last_heartbeat_at == hb_at.isoformat()
    # Sign-in, task metadata must be preserved verbatim.
    assert stamped.sessions[-1].sign_in_at == att.sessions[-1].sign_in_at


def test_record_heartbeat_is_noop_when_signed_out():
    att = _att(
        sign_in_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
        sign_out_at=datetime(2026, 5, 1, 17, 0, tzinfo=timezone.utc),
    )
    same = att.record_heartbeat(datetime(2026, 5, 1, 18, 0, tzinfo=timezone.utc))
    assert same is att or same.sessions[-1].last_heartbeat_at is None


# ── SweepStaleSessionsUseCase (repo orchestration) ────────────────────


def test_use_case_scans_today_and_yesterday():
    now_utc = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    # Sessions on both yesterday IST and today IST.
    stale_hb = now_utc - timedelta(minutes=30)
    today_ist = now_utc.astimezone(IST).strftime("%Y-%m-%d")
    yesterday_ist = (
        now_utc.astimezone(IST) - timedelta(days=1)
    ).strftime("%Y-%m-%d")

    records = {
        yesterday_ist: [
            _att(user_id="u-yesterday", date=yesterday_ist, last_heartbeat_at=stale_hb),
        ],
        today_ist: [
            _att(user_id="u-today", date=today_ist, last_heartbeat_at=stale_hb),
        ],
    }
    repo = _FakeRepo(records)
    result = SweepStaleSessionsUseCase(repo).execute(
        now=now_utc, grace_minutes=15
    )
    assert result.sessions_closed == 2
    assert result.sessions_inspected == 2
    # Both saved.
    saved_users = {a.user_id for a in repo.saved}
    assert saved_users == {"u-yesterday", "u-today"}


def test_use_case_leaves_healthy_sessions_alone():
    now_utc = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    date = now_utc.astimezone(IST).strftime("%Y-%m-%d")
    records = {
        date: [
            # recent heartbeat
            _att(user_id="active", date=date, last_heartbeat_at=now_utc - timedelta(minutes=1)),
            # already signed out
            _att(
                user_id="done",
                date=date,
                sign_in_at=datetime(2026, 5, 1, 8, 0, tzinfo=timezone.utc),
                sign_out_at=datetime(2026, 5, 1, 9, 0, tzinfo=timezone.utc),
            ),
        ],
    }
    repo = _FakeRepo(records)
    result = SweepStaleSessionsUseCase(repo).execute(
        now=now_utc, grace_minutes=15
    )
    assert result.sessions_closed == 0
    # Signed-out ones aren't even "inspected" per our counter semantics —
    # is_signed_in filters early.
    assert result.sessions_inspected == 1
    assert repo.saved == []


def test_use_case_records_errors_without_aborting():
    """A single-record save failure must not prevent the rest of the
    sweep from running. Simulate by making save() raise once."""
    now_utc = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    date = now_utc.astimezone(IST).strftime("%Y-%m-%d")
    stale_hb = now_utc - timedelta(minutes=30)
    records = {
        date: [
            _att(user_id="u1", date=date, last_heartbeat_at=stale_hb),
            _att(user_id="u2", date=date, last_heartbeat_at=stale_hb),
        ],
    }

    class FlakyRepo(_FakeRepo):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw)
            self._calls = 0

        def save(self, attendance):
            self._calls += 1
            if self._calls == 1:
                raise RuntimeError("transient dynamo failure")
            super().save(attendance)

    repo = FlakyRepo(records)
    result = SweepStaleSessionsUseCase(repo).execute(now=now_utc, grace_minutes=15)
    assert result.sessions_inspected == 2
    assert result.sessions_closed == 1
    assert result.errors == 1
