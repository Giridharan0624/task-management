"""One-off: close every currently-signed-in attendance session for a tenant.

Use when the dashboard's "Working now" panel is full of stuck users —
typically caused by demo seed data with open sessions, or by clients
that crashed before posting sign-out. Different from the scheduled
sweeper (sweep_stale_sessions) which respects a heartbeat grace window;
this one is unconditional and immediate.

Usage:
  # dry run — list what would be closed, change nothing
  python scripts/force_signout_all.py --org-id neurostack --dry-run

  # for real
  python scripts/force_signout_all.py --org-id neurostack --confirm

  # only close sessions older than N minutes (defensive)
  python scripts/force_signout_all.py --org-id neurostack --confirm --min-age-minutes 30

Closes the session with sign_out_at = now (UTC). Idempotent — re-running
on already-closed sessions is a no-op (is_signed_in returns False).
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
sys.path.insert(0, _SRC)

from contexts.attendance.domain.entities import IST  # noqa: E402
from contexts.attendance.infrastructure.dynamo_repository import (  # noqa: E402
    AttendanceDynamoRepository,
)


def _dates_to_check(now: datetime) -> list[str]:
    """Today + yesterday in IST — same window the scheduled sweeper uses
    so we cover sessions that crossed midnight without re-scanning the
    whole table."""
    ist_now = now.astimezone(IST)
    return [
        (ist_now - timedelta(days=1)).strftime("%Y-%m-%d"),
        ist_now.strftime("%Y-%m-%d"),
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True, help="Tenant org_id, e.g. 'neurostack'")
    parser.add_argument(
        "--min-age-minutes",
        type=int,
        default=0,
        help="Only close sessions whose sign_in_at is older than this. "
        "Default 0 = close everything currently signed in.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true")
    group.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=args.min_age_minutes)
    repo = AttendanceDynamoRepository(org_id=args.org_id)

    print(f"force-signout: org={args.org_id} now={now.isoformat()}")
    print(f"  dates checked   : {_dates_to_check(now)}")
    print(f"  min age (mins)  : {args.min_age_minutes}")
    print(f"  dry-run         : {args.dry_run}")
    print()

    inspected = 0
    eligible = 0
    closed = 0
    errors = 0

    for date in _dates_to_check(now):
        try:
            attendances = repo.find_all_by_date(date)
        except Exception as exc:
            print(f"  ! find_all_by_date({date}) failed: {exc}")
            errors += 1
            continue

        for att in attendances:
            inspected += 1
            if not att.is_signed_in:
                continue
            session = att.current_session
            assert session is not None
            sign_in_at = datetime.fromisoformat(session.sign_in_at)
            if sign_in_at.tzinfo is None:
                sign_in_at = sign_in_at.replace(tzinfo=timezone.utc)
            if sign_in_at > cutoff:
                # Younger than --min-age-minutes — skip.
                continue
            eligible += 1
            label = f"  - user={att.user_id} date={att.date} sign_in_at={session.sign_in_at}"
            if args.dry_run:
                print(label + "  [DRY RUN]")
                continue
            try:
                closed_att = att.sign_out(at=now)
                repo.save(closed_att)
                closed += 1
                print(label + "  CLOSED")
            except Exception as exc:
                errors += 1
                print(label + f"  ERROR: {exc}")

    print()
    print(
        f"force-signout: inspected={inspected} eligible={eligible} "
        f"closed={closed} errors={errors}"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
