"""Weekly rollup — AI-assisted digest of the org's task updates.

Authorisation: gated behind TASKUPDATE_LIST_ALL (owner + admin by default,
same access tier as the daily updates list).

Request: GET /task-updates/weekly-rollup?week_start=YYYY-MM-DD&regenerate=true
  - week_start is optional. When omitted we default to the Monday of the
    current IST week, which is the week-boundary used elsewhere in the
    dashboard (attendance week leaderboard etc.).
  - regenerate is optional (default false). When false the handler
    returns a cached rollup if present — avoids the Groq round-trip on
    every page load. When true, regenerate from source data and
    overwrite the cache. Only the explicit "Regenerate" button on the
    UI passes this flag.

Cache shape: one DynamoDB row per (org, week) at
  PK = ORG#{org_id}
  SK = WEEKLY_ROLLUP#{week_start}
The cached row stores the entire response body verbatim, so a hit is a
single get + a JSON load — no per-source aggregation, no Groq call.

Response shape — see `_build_payload` below. The handler returns
deterministic metrics alongside the AI-generated narrative so the
client never has to trust the model's numeric output.
"""
from __future__ import annotations

import json
import logging
from datetime import date as date_cls, datetime, timedelta, timezone
from typing import Any, Optional

from contexts.activity.infrastructure.dynamo_repository import (
    ActivityDynamoRepository,
)
from contexts.attendance.infrastructure.dynamo_repository import (
    AttendanceDynamoRepository,
)
from contexts.dayoff.infrastructure.dynamo_repository import (
    DayOffDynamoRepository,
)
from contexts.org.domain import permissions as P
from contexts.taskupdate.infrastructure.ai_service import (
    aggregate,
    detect_anomalies,
    generate_weekly_narrative,
)
from contexts.taskupdate.infrastructure.dynamo_repository import (
    TaskUpdateDynamoRepository,
)
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import tenant_keys
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.dynamo_client import get_table
from shared_kernel.errors import ValidationError
from shared_kernel.permissions import require, require_feature
from shared_kernel.response import build_error, build_success

log = logging.getLogger("taskflow.weekly_rollup")

IST = timezone(timedelta(hours=5, minutes=30))


def _parse_or_default_week_start(raw: str | None) -> date_cls:
    """Week starts Monday in IST. Falls back to the current week's Monday."""
    if raw:
        try:
            parsed = date_cls.fromisoformat(raw)
        except ValueError:
            raise ValidationError("week_start must be in YYYY-MM-DD format")
        # Snap to the Monday of whatever week was supplied so clients can
        # send any date inside a week and get the same rollup back. This
        # is what makes the result cacheable per week_start later on.
        return parsed - timedelta(days=parsed.weekday())

    today_ist = datetime.now(IST).date()
    return today_ist - timedelta(days=today_ist.weekday())


_REGENERATE_TRUTHY = {"true", "1", "yes"}


def _load_cached(org_id: str, week_start: str) -> Optional[dict]:
    """Best-effort cache read. Returns the previously-stored payload or
    None on miss / DDB error."""
    try:
        resp = get_table().get_item(
            Key={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.weekly_rollup_sk(week_start),
            }
        )
    except Exception as e:
        log.warning(
            "weekly-rollup-cache-read-failed",
            extra={"org_id": org_id, "week_start": week_start, "error": str(e)[:200]},
        )
        return None

    item = resp.get("Item")
    if not item:
        return None
    raw = item.get("payload")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return None


def _store_cached(org_id: str, week_start: str, payload: dict) -> None:
    """Best-effort cache write — never raises. A failed put just means
    the next request regenerates; nothing breaks for the user."""
    try:
        get_table().put_item(
            Item={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.weekly_rollup_sk(week_start),
                "org_id": org_id,
                "week_start": week_start,
                "payload": json.dumps(payload, default=str),
                "cached_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as e:
        log.warning(
            "weekly-rollup-cache-write-failed",
            extra={"org_id": org_id, "week_start": week_start, "error": str(e)[:200]},
        )


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require(auth, P.TASKUPDATE_LIST_ALL)
        # Plan gate — the rollup is a Groq round-trip + anomaly detector,
        # both PRO-tier features. Same `ai_summaries` umbrella flag the
        # activity day-summary handler uses.
        require_feature(auth, "ai_summaries")

        query_params = event.get("queryStringParameters") or {}
        week_start = _parse_or_default_week_start(query_params.get("week_start"))
        week_end = week_start + timedelta(days=6)
        regenerate = (
            (query_params.get("regenerate") or "").lower() in _REGENERATE_TRUTHY
        )

        # Cache lookup unless the caller explicitly asked to regenerate.
        # A hit returns the original payload as-is (incl. its original
        # generated_at timestamp) so the user knows when this view of
        # the week was computed.
        if not regenerate:
            cached = _load_cached(auth.org_id, week_start.isoformat())
            if cached is not None:
                return build_success(200, cached)

        update_repo = TaskUpdateDynamoRepository()
        user_repo = UserDynamoRepository()
        attendance_repo = AttendanceDynamoRepository()
        activity_repo = ActivityDynamoRepository()
        dayoff_repo = DayOffDynamoRepository()

        updates = update_repo.find_by_date_range(
            week_start.isoformat(),
            week_end.isoformat(),
        )

        # Parallel data pulls — each wrapped so one failing source doesn't
        # torpedo the whole rollup. All three are additive context; the
        # task-update slice is the canonical source.
        try:
            attendance_records = attendance_repo.find_all_by_date_range(
                week_start.isoformat(), week_end.isoformat()
            )
        except Exception:
            attendance_records = []

        try:
            activity_records = activity_repo.find_all_by_date_range(
                week_start.isoformat(), week_end.isoformat()
            )
        except Exception:
            activity_records = []

        try:
            # No date-range query on dayoff repo — aggregate filters in-memory
            # by overlap. Acceptable until a tenant has thousands of requests.
            dayoff_requests = dayoff_repo.find_all()
        except Exception:
            dayoff_requests = []

        # Team-size context helps the prompt distinguish "small team had a
        # quiet week" from "large team had a lot of unreported work".
        # We also keep the roster around so the anomaly detector can flag
        # zero-activity members.
        try:
            team_users = list(user_repo.find_all())
            team_size = len(team_users)
            team_member_names = [
                getattr(u, "name", None) or u.get("name", "")
                if hasattr(u, "name") or isinstance(u, dict)
                else ""
                for u in team_users
            ]
            team_member_names = [n for n in team_member_names if n]
        except Exception:
            team_size = 0
            team_member_names = []

        facts = aggregate(
            updates,
            week_start.isoformat(),
            week_end.isoformat(),
            attendance_records=attendance_records,
            activity_records=activity_records,
            dayoff_requests=dayoff_requests,
        )

        # Run the deterministic anomaly detector and attach its output to
        # `facts` BEFORE the AI call — the prompt reads `facts.anomalies`
        # and the cached payload exposes them to the UI.
        facts.anomalies = detect_anomalies(facts, team_member_names)

        # Diagnostic — remove after verifying staging. Shows exactly what
        # numeric facts the handler computed so we can tell whether
        # zero-tiles mean "backend found nothing" vs "AI hallucinated vs
        # real numbers" vs "response shape is wrong".
        print(
            "WEEKLY_ROLLUP_DIAG "
            + json.dumps(
                {
                    "org_id": getattr(auth, "org_id", None),
                    "user_id": getattr(auth, "user_id", None),
                    "week_start": facts.start_date,
                    "week_end": facts.end_date,
                    "team_size": team_size,
                    "counts": {
                        "updates_raw": len(list(updates)) if not isinstance(updates, list) else len(updates),
                        "total_updates": facts.total_updates,
                        "contributor_count": facts.contributor_count,
                        "total_hours": facts.total_hours,
                        "attendance_records_raw": len(attendance_records),
                        "attendance_total_hours": facts.attendance_total_hours,
                        "attendance_sessions_count": facts.attendance_sessions_count,
                        "attendance_contributor_count": facts.attendance_contributor_count,
                        "activity_records_raw": len(activity_records),
                        "activity_total_active_minutes": facts.activity_total_active_minutes,
                        "activity_avg_score": facts.activity_avg_score,
                        "dayoff_requests_raw": len(dayoff_requests),
                        "dayoffs_approved_count": facts.dayoffs_approved_count,
                        "dayoffs_days_lost": facts.dayoffs_days_lost,
                    },
                }
            )
        )

        narrative = generate_weekly_narrative(facts, team_size)

        payload: dict[str, Any] = {
            "week_start": facts.start_date,
            "week_end": facts.end_date,
            "team_size": team_size,
            "metrics": {
                "total_updates": facts.total_updates,
                "contributor_count": facts.contributor_count,
                "total_hours": facts.total_hours,
                "missing_days": facts.missing_days,
                # Cross-dimension headlines
                "attendance_total_hours": facts.attendance_total_hours,
                "attendance_contributor_count": facts.attendance_contributor_count,
                "attendance_sessions_count": facts.attendance_sessions_count,
                "activity_avg_score": facts.activity_avg_score,
                "activity_total_active_minutes": facts.activity_total_active_minutes,
                "activity_total_idle_minutes": facts.activity_total_idle_minutes,
                "activity_contributor_count": facts.activity_contributor_count,
                "dayoffs_approved_count": facts.dayoffs_approved_count,
                "dayoffs_days_lost": facts.dayoffs_days_lost,
            },
            "by_contributor": facts.by_contributor,
            "by_task": facts.by_task,
            "by_day": facts.by_day,
            # Per-dimension breakdowns
            "attendance_by_day": facts.attendance_by_day,
            "attendance_by_contributor": facts.attendance_by_contributor,
            "activity_top_apps": facts.activity_top_apps,
            "dayoffs_requests": facts.dayoffs_requests,
            # Deterministic anomalies — the UI renders these in their own
            # section; the AI prompt has already received them and may
            # also paraphrase them in concerns/highlights.
            "anomalies": facts.anomalies,
            "narrative": narrative,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Cache write — best-effort. Stored AFTER the Groq call succeeds,
        # so a partial generation never lands in the cache.
        _store_cached(auth.org_id, facts.start_date, payload)

        return build_success(200, payload)
    except Exception as e:
        return build_error(e)
