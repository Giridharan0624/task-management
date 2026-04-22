"""Weekly rollup — AI-assisted digest of the org's task updates.

Authorisation: gated behind TASKUPDATE_LIST_ALL (owner + admin by default,
same access tier as the daily updates list).

Request: GET /task-updates/weekly-rollup?week_start=YYYY-MM-DD
  - week_start is optional. When omitted we default to the Monday of the
    current IST week, which is the week-boundary used elsewhere in the
    dashboard (attendance week leaderboard etc.).

Response shape — see `build_response` below. The handler returns
deterministic metrics alongside the AI-generated narrative so the client
never has to trust the model's numeric output.
"""
from __future__ import annotations

from datetime import date as date_cls, datetime, timedelta, timezone

from contexts.org.domain import permissions as P
from contexts.taskupdate.infrastructure.ai_service import (
    aggregate,
    generate_weekly_narrative,
)
from contexts.taskupdate.infrastructure.dynamo_repository import (
    TaskUpdateDynamoRepository,
)
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import ValidationError
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success

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


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require(auth, P.TASKUPDATE_LIST_ALL)

        query_params = event.get("queryStringParameters") or {}
        week_start = _parse_or_default_week_start(query_params.get("week_start"))
        week_end = week_start + timedelta(days=6)

        update_repo = TaskUpdateDynamoRepository()
        user_repo = UserDynamoRepository()

        updates = update_repo.find_by_date_range(
            week_start.isoformat(),
            week_end.isoformat(),
        )

        # Team-size context helps the prompt distinguish "small team had a
        # quiet week" from "large team had a lot of unreported work".
        try:
            team_size = len(user_repo.find_all())
        except Exception:
            # Don't let a user-list failure block the rollup — we degrade
            # by passing 0, the prompt just won't quote a team size.
            team_size = 0

        facts = aggregate(updates, week_start.isoformat(), week_end.isoformat())
        narrative = generate_weekly_narrative(facts, team_size)

        return build_success(
            200,
            {
                "week_start": facts.start_date,
                "week_end": facts.end_date,
                "team_size": team_size,
                "metrics": {
                    "total_updates": facts.total_updates,
                    "contributor_count": facts.contributor_count,
                    "total_hours": facts.total_hours,
                    "missing_days": facts.missing_days,
                },
                "by_contributor": facts.by_contributor,
                "by_task": facts.by_task,
                "by_day": facts.by_day,
                "narrative": narrative,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception as e:
        return build_error(e)
