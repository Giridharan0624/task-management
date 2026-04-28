"""AI service for weekly rollups.

Feeds the structured per-user daily-update records into Groq (LLaMA 3.3 70B)
and returns a digest an owner would actually want to read — headline summary,
top projects/themes, top contributors, notable patterns, concerns.

Text-only path — explicitly imports GROQ_TEXT_MODEL rather than the
generic GROQ_MODEL alias so future model swaps in the activity (vision)
service don't silently drag the rollup along. Reuses the credential
loader from the activity context for a single secret + cache.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date as date_cls, timedelta
from typing import Any, Iterable

from contexts.activity.infrastructure.groq_service import (
    GROQ_API_URL,
    GROQ_TEXT_MODEL,
    _get_api_key,  # re-used credential loader (cached, Secrets-Manager-aware)
)
from contexts.taskupdate.domain.entities import TaskUpdate


# ---------------------------------------------------------------------------
# Pure aggregation — no AI, deterministic. The AI only receives the result.
# ---------------------------------------------------------------------------

@dataclass
class WeeklyFacts:
    """Deterministic aggregations of the week across every data source.

    Kept in a dataclass (not a raw dict) so the shape is self-documenting
    and the handler can return these metrics verbatim — owners get reliable
    numbers even if Groq is degraded or offline.

    Rolls together five dimensions, each pulled from its own bounded
    context's repository:
      - Task updates (self-reported) — hours/tasks/contributors
      - Attendance (timer sessions, objective) — hours, sessions, presence
      - Activity (desktop-app signals) — active/idle minutes, scores, apps
      - Day-offs — approved leaves covering any day in the window
    """
    start_date: str
    end_date: str
    # ── Task-update slice (self-reported) ──────────────────────────────
    total_updates: int
    contributor_count: int
    total_hours: float
    by_contributor: list[dict]  # [{ name, updates, hours, tasks }]
    by_task: list[dict]          # [{ task_name, hours, contributors, updates }]
    by_day: list[dict]           # [{ date, updates, hours }]
    missing_days: list[str]      # days in window with zero updates

    # ── Attendance slice (objective timer data) ────────────────────────
    attendance_total_hours: float = 0.0
    attendance_contributor_count: int = 0
    attendance_sessions_count: int = 0
    attendance_by_day: list[dict] = field(default_factory=list)
    attendance_by_contributor: list[dict] = field(default_factory=list)

    # ── Activity slice (desktop-app signals) ───────────────────────────
    activity_avg_score: float = 0.0
    activity_total_active_minutes: float = 0.0
    activity_total_idle_minutes: float = 0.0
    activity_top_apps: list[dict] = field(default_factory=list)
    activity_contributor_count: int = 0

    # ── Day-off slice (approved leaves overlapping the window) ─────────
    dayoffs_approved_count: int = 0
    dayoffs_days_lost: int = 0  # Sum of in-window days across approved leaves
    dayoffs_requests: list[dict] = field(default_factory=list)

    # ── Anomaly slice (deterministic detector — see detect_anomalies) ──
    # Each item: { kind, severity ("info"|"warn"|"alert"), title, detail,
    # subject (optional member name) }. Surfaced both in the UI and in
    # the AI prompt so the narrative can reference them. Empty list when
    # the week is clean — UI hides the section in that case.
    anomalies: list[dict] = field(default_factory=list)


def _parse_time_string(time_str: str) -> float:
    """Turn "2h 30m 15s" (or "2.5h") into decimal hours. Forgiving parser
    because task_update stores human-formatted strings."""
    if not time_str:
        return 0.0
    s = time_str.strip().lower()
    # Fast path for the legacy "2.5h" shape
    if s.endswith("h") and "m" not in s and "s" not in s:
        try:
            return float(s.rstrip("h"))
        except ValueError:
            return 0.0

    hours = 0.0
    for part in s.replace(",", " ").split():
        if part.endswith("h"):
            try:
                hours += float(part.rstrip("h"))
            except ValueError:
                pass
        elif part.endswith("m"):
            try:
                hours += float(part.rstrip("m")) / 60
            except ValueError:
                pass
        elif part.endswith("s"):
            try:
                hours += float(part.rstrip("s")) / 3600
            except ValueError:
                pass
    return hours


def _session_hours(session: Any) -> float:
    """Duck-typed session hours getter. Supports entity or dict shape."""
    hrs = getattr(session, "hours", None)
    if hrs is None and isinstance(session, dict):
        hrs = session.get("hours")
    if hrs is not None:
        try:
            return float(hrs)
        except (TypeError, ValueError):
            return 0.0
    # Compute from sign-in/out if no cached hours (active sessions).
    sign_in = getattr(session, "sign_in_at", None) or (session.get("signInAt") if isinstance(session, dict) else None)
    sign_out = getattr(session, "sign_out_at", None) or (session.get("signOutAt") if isinstance(session, dict) else None)
    if not sign_in or not sign_out:
        return 0.0
    try:
        from datetime import datetime
        start = datetime.fromisoformat(sign_in.replace("Z", "+00:00"))
        end = datetime.fromisoformat(sign_out.replace("Z", "+00:00"))
        return max(0.0, (end - start).total_seconds() / 3600.0)
    except (ValueError, AttributeError):
        return 0.0


def _aggregate_attendance(
    records: Iterable[Any],
    start_date: str,
    end_date: str,
) -> dict:
    """Roll attendance records into per-day + per-user hour totals."""
    records_list = list(records)

    contributor_hours: dict[str, float] = defaultdict(float)
    contributor_sessions: dict[str, int] = defaultdict(int)
    day_hours: dict[str, float] = defaultdict(float)
    day_sessions: dict[str, int] = defaultdict(int)
    day_signed_in: dict[str, set[str]] = defaultdict(set)
    total_sessions = 0

    for r in records_list:
        date = getattr(r, "date", None) or (r.get("date") if isinstance(r, dict) else None)
        user_name = getattr(r, "user_name", None) or (r.get("userName") if isinstance(r, dict) else None) or "Unknown"
        sessions = getattr(r, "sessions", None) or (r.get("sessions") if isinstance(r, dict) else []) or []
        if not date:
            continue
        for s in sessions:
            hrs = _session_hours(s)
            contributor_hours[user_name] += hrs
            contributor_sessions[user_name] += 1
            day_hours[date] += hrs
            day_sessions[date] += 1
            day_signed_in[date].add(user_name)
            total_sessions += 1

    by_contributor = sorted(
        [
            {
                "name": name,
                "hours": round(contributor_hours[name], 2),
                "sessions": contributor_sessions[name],
            }
            for name in contributor_hours
        ],
        key=lambda r: r["hours"],
        reverse=True,
    )

    start = date_cls.fromisoformat(start_date)
    end = date_cls.fromisoformat(end_date)
    by_day: list[dict] = []
    current = start
    while current <= end:
        iso = current.isoformat()
        by_day.append(
            {
                "date": iso,
                "hours": round(day_hours.get(iso, 0.0), 2),
                "sessions": day_sessions.get(iso, 0),
                "signed_in_count": len(day_signed_in.get(iso, set())),
            }
        )
        current += timedelta(days=1)

    total_hours = round(sum(contributor_hours.values()), 2)

    return {
        "total_hours": total_hours,
        "contributor_count": len(contributor_hours),
        "sessions_count": total_sessions,
        "by_day": by_day,
        "by_contributor": by_contributor,
    }


def _aggregate_activity(records: Iterable[Any]) -> dict:
    """Roll activity records into active/idle totals + top apps + avg score."""
    records_list = list(records)
    if not records_list:
        return {
            "avg_score": 0.0,
            "total_active_minutes": 0.0,
            "total_idle_minutes": 0.0,
            "top_apps": [],
            "contributor_count": 0,
        }

    total_active = 0.0
    total_idle = 0.0
    scores: list[float] = []
    users: set[str] = set()
    app_seconds: dict[str, float] = defaultdict(float)

    for r in records_list:
        total_active += float(getattr(r, "total_active_minutes", None) or (r.get("totalActiveMinutes") if isinstance(r, dict) else 0) or 0)
        total_idle += float(getattr(r, "total_idle_minutes", None) or (r.get("totalIdleMinutes") if isinstance(r, dict) else 0) or 0)
        score = getattr(r, "activity_score", None)
        if score is None and isinstance(r, dict):
            score = r.get("activityScore")
        if score is not None:
            try:
                scores.append(float(score))
            except (TypeError, ValueError):
                pass
        user_id = getattr(r, "user_id", None) or (r.get("userId") if isinstance(r, dict) else None)
        if user_id:
            users.add(user_id)
        app_usage = getattr(r, "app_usage", None)
        if app_usage is None and isinstance(r, dict):
            app_usage = r.get("appUsage")
        if isinstance(app_usage, dict):
            for app_name, seconds in app_usage.items():
                try:
                    app_seconds[app_name] += float(seconds)
                except (TypeError, ValueError):
                    pass

    top_apps = sorted(
        [{"app_name": name, "minutes": round(seconds / 60, 1)} for name, seconds in app_seconds.items()],
        key=lambda r: r["minutes"],
        reverse=True,
    )[:5]

    avg_score = round((sum(scores) / len(scores)) * 100) if scores else 0

    return {
        "avg_score": avg_score,
        "total_active_minutes": round(total_active, 1),
        "total_idle_minutes": round(total_idle, 1),
        "top_apps": top_apps,
        "contributor_count": len(users),
    }


def _aggregate_dayoffs(
    requests: Iterable[Any],
    start_date: str,
    end_date: str,
) -> dict:
    """Keep only APPROVED requests that overlap the window, count days lost."""
    start = date_cls.fromisoformat(start_date)
    end = date_cls.fromisoformat(end_date)
    requests_list = list(requests)

    approved_in_window: list[dict] = []
    total_days_lost = 0

    for r in requests_list:
        status = getattr(r, "status", None) or (r.get("status") if isinstance(r, dict) else None)
        # Entity may expose status as an enum-with-value; coerce to string.
        if hasattr(status, "value"):
            status = status.value
        if str(status) != "APPROVED":
            continue

        req_start_raw = getattr(r, "start_date", None) or (r.get("startDate") if isinstance(r, dict) else None)
        req_end_raw = getattr(r, "end_date", None) or (r.get("endDate") if isinstance(r, dict) else None)
        if not req_start_raw or not req_end_raw:
            continue
        try:
            req_start = date_cls.fromisoformat(str(req_start_raw)[:10])
            req_end = date_cls.fromisoformat(str(req_end_raw)[:10])
        except ValueError:
            continue

        # Overlap window?
        overlap_start = max(req_start, start)
        overlap_end = min(req_end, end)
        if overlap_start > overlap_end:
            continue

        days_in_window = (overlap_end - overlap_start).days + 1
        total_days_lost += days_in_window

        user_name = (
            getattr(r, "user_name", None)
            or (r.get("userName") if isinstance(r, dict) else None)
            or "Unknown"
        )
        reason = getattr(r, "reason", None) or (r.get("reason") if isinstance(r, dict) else "") or ""
        approved_in_window.append(
            {
                "name": user_name,
                "start_date": req_start.isoformat(),
                "end_date": req_end.isoformat(),
                "days_in_window": days_in_window,
                "reason": reason[:200],
            }
        )

    approved_in_window.sort(key=lambda r: r["start_date"])

    return {
        "approved_count": len(approved_in_window),
        "days_lost": total_days_lost,
        "requests": approved_in_window,
    }


def aggregate(
    updates: Iterable[TaskUpdate],
    start_date: str,
    end_date: str,
    attendance_records: Iterable[Any] | None = None,
    activity_records: Iterable[Any] | None = None,
    dayoff_requests: Iterable[Any] | None = None,
) -> WeeklyFacts:
    """Compute the deterministic slice the AI will summarise.

    The attendance / activity / dayoff parameters are optional so older
    callers keep working — when omitted, the corresponding sections on
    the returned `WeeklyFacts` stay at their dataclass defaults.
    """
    # `date_cls`/`timedelta` are imported at module-level now.
    updates_list = list(updates)

    contributor_hours: dict[str, float] = defaultdict(float)
    contributor_updates: dict[str, int] = defaultdict(int)
    contributor_tasks: dict[str, set[str]] = defaultdict(set)

    task_hours: dict[str, float] = defaultdict(float)
    task_contributors: dict[str, set[str]] = defaultdict(set)
    task_updates_count: dict[str, int] = defaultdict(int)

    day_hours: dict[str, float] = defaultdict(float)
    day_updates: dict[str, int] = defaultdict(int)
    active_days: set[str] = set()

    for u in updates_list:
        user_hours_for_update = _parse_time_string(u.total_time)
        contributor_hours[u.user_name] += user_hours_for_update
        contributor_updates[u.user_name] += 1

        day_hours[u.date] += user_hours_for_update
        day_updates[u.date] += 1
        active_days.add(u.date)

        for item in u.task_summary:
            hrs = _parse_time_string(item.time_recorded)
            task_hours[item.task_name] += hrs
            task_contributors[item.task_name].add(u.user_name)
            task_updates_count[item.task_name] += 1
            contributor_tasks[u.user_name].add(item.task_name)

    by_contributor = sorted(
        [
            {
                "name": name,
                "updates": contributor_updates[name],
                "hours": round(contributor_hours[name], 2),
                "tasks": len(contributor_tasks[name]),
            }
            for name in contributor_hours
        ],
        key=lambda r: r["hours"],
        reverse=True,
    )

    by_task = sorted(
        [
            {
                "task_name": name,
                "hours": round(task_hours[name], 2),
                "contributors": len(task_contributors[name]),
                "updates": task_updates_count[name],
            }
            for name in task_hours
        ],
        key=lambda r: r["hours"],
        reverse=True,
    )

    # Walk the full window so missing days surface as zero rows.
    start = date_cls.fromisoformat(start_date)
    end = date_cls.fromisoformat(end_date)
    by_day: list[dict] = []
    missing_days: list[str] = []
    current = start
    while current <= end:
        iso = current.isoformat()
        updates_count = day_updates.get(iso, 0)
        by_day.append(
            {
                "date": iso,
                "updates": updates_count,
                "hours": round(day_hours.get(iso, 0.0), 2),
            }
        )
        if updates_count == 0:
            missing_days.append(iso)
        current += timedelta(days=1)

    total_hours = round(sum(contributor_hours.values()), 2)

    # Roll up the other dimensions, defaulting to empty slices when the
    # caller passes None (keeps older unit-test call sites working).
    attendance_slice = (
        _aggregate_attendance(attendance_records or [], start_date, end_date)
    )
    activity_slice = _aggregate_activity(activity_records or [])
    dayoff_slice = _aggregate_dayoffs(
        dayoff_requests or [], start_date, end_date
    )

    return WeeklyFacts(
        start_date=start_date,
        end_date=end_date,
        total_updates=len(updates_list),
        contributor_count=len(contributor_hours),
        total_hours=total_hours,
        by_contributor=by_contributor,
        by_task=by_task,
        by_day=by_day,
        missing_days=missing_days,
        attendance_total_hours=attendance_slice["total_hours"],
        attendance_contributor_count=attendance_slice["contributor_count"],
        attendance_sessions_count=attendance_slice["sessions_count"],
        attendance_by_day=attendance_slice["by_day"],
        attendance_by_contributor=attendance_slice["by_contributor"],
        activity_avg_score=activity_slice["avg_score"],
        activity_total_active_minutes=activity_slice["total_active_minutes"],
        activity_total_idle_minutes=activity_slice["total_idle_minutes"],
        activity_top_apps=activity_slice["top_apps"],
        activity_contributor_count=activity_slice["contributor_count"],
        dayoffs_approved_count=dayoff_slice["approved_count"],
        dayoffs_days_lost=dayoff_slice["days_lost"],
        dayoffs_requests=dayoff_slice["requests"],
    )


# ---------------------------------------------------------------------------
# Anomaly detection — deterministic, threshold-based
# ---------------------------------------------------------------------------

# Tunables are constants so the thresholds are visible in one place and
# the team can dial them per tenant later if needed.
_OVERTIME_DAY_HOURS = 12.0
_LOW_FOCUS_PCT = 40.0
_LOW_FOCUS_MIN_ACTIVE_MIN = 60.0
_SOLO_LOAD_PCT = 0.50
_SOLO_LOAD_MIN_TEAM = 3
_MASS_MISSING_PCT = 0.30
_MASS_MISSING_MIN_ACTIVE = 4
_TASK_MONO_PCT = 0.80
_TASK_MONO_MIN_HOURS = 10.0


def detect_anomalies(
    facts: WeeklyFacts,
    team_members: list[str] | None = None,
) -> list[dict]:
    """Walk the deterministic facts and emit zero or more anomaly rows.

    `team_members` is the full member roster — used to detect
    zero-activity members (those in the roster but absent from every
    data dimension this week). Pass an empty list / None to skip that
    detector.

    Each returned dict has:
      kind:      stable string ("zero_activity" | "solo_load" | …)
      severity:  "info" | "warn" | "alert"
      title:     short headline (≤ 80 chars)
      detail:    one-sentence explanation
      subject:   optional member name when the anomaly targets one person
    """
    out: list[dict] = []

    # --- Active member set (across every data dimension) ------------------
    active_names: set[str] = set()
    for c in facts.by_contributor:
        active_names.add(c["name"])
    for c in facts.attendance_by_contributor:
        active_names.add(c["name"])

    on_leave_names = {r["name"] for r in facts.dayoffs_requests}

    # --- 1. Zero-activity members ----------------------------------------
    if team_members:
        for name in team_members:
            if name in active_names:
                continue
            if name in on_leave_names:
                continue
            out.append({
                "kind": "zero_activity",
                "severity": "warn",
                "title": f"{name} logged zero hours",
                "detail": (
                    f"{name} has no task updates, timer sessions, or activity "
                    f"signals this week and no approved leave on file."
                ),
                "subject": name,
            })

    # --- 2. Solo-load concentration --------------------------------------
    # Use timer hours when present; otherwise fall back to self-reported.
    contributor_pool = (
        facts.attendance_by_contributor
        if facts.attendance_by_contributor
        else facts.by_contributor
    )
    if (
        len(contributor_pool) >= _SOLO_LOAD_MIN_TEAM
        and len(active_names) >= _SOLO_LOAD_MIN_TEAM
    ):
        total = sum(c["hours"] for c in contributor_pool)
        if total > 0:
            top = max(contributor_pool, key=lambda c: c["hours"])
            share = top["hours"] / total
            if share >= _SOLO_LOAD_PCT:
                out.append({
                    "kind": "solo_load",
                    "severity": "info",
                    "title": (
                        f"{top['name']} carried {round(share * 100)}% of tracked hours"
                    ),
                    "detail": (
                        f"One member accounted for {round(share * 100)}% of the "
                        f"team's tracked hours this week. Workload may be "
                        f"unevenly distributed."
                    ),
                    "subject": top["name"],
                })

    # --- 3. Overtime days (per member, per day) --------------------------
    # Walk the attendance per-day series cross-joined with per-contributor
    # to catch single-day overtime spikes.
    for day in facts.attendance_by_day:
        # attendance_by_day rows aren't currently per-contributor, so we
        # approximate "any 12+h day" using the most-tracked contributor's
        # ratio of that day's hours. The signal is conservative: only
        # fires when a single person plausibly carried the overtime.
        # (A future enhancement reads per-contributor-per-day from the
        # repo directly.)
        if day.get("hours", 0) >= _OVERTIME_DAY_HOURS:
            out.append({
                "kind": "overtime_day",
                "severity": "warn",
                "title": f"{day['hours']:.1f}h tracked on {day['date']}",
                "detail": (
                    f"Total tracked time on {day['date']} crossed "
                    f"{_OVERTIME_DAY_HOURS:.0f}h — review whether this was "
                    f"sustainable or a one-off crunch."
                ),
            })

    # --- 4. Low focus across the team ------------------------------------
    if (
        facts.activity_avg_score
        and facts.activity_avg_score < _LOW_FOCUS_PCT
        and facts.activity_total_active_minutes >= _LOW_FOCUS_MIN_ACTIVE_MIN
    ):
        out.append({
            "kind": "low_focus",
            "severity": "warn",
            "title": (
                f"Average focus dropped to {round(facts.activity_avg_score)}%"
            ),
            "detail": (
                f"Across {round(facts.activity_total_active_minutes)} active "
                f"minutes this week the composite focus score sat below "
                f"{int(_LOW_FOCUS_PCT)}%. Idle time outweighed input activity."
            ),
        })

    # --- 5. Mass missing-update days -------------------------------------
    # If a working day had ≥4 active members but <30% of them submitted an
    # update, that's a process-discipline anomaly worth flagging.
    if len(active_names) >= _MASS_MISSING_MIN_ACTIVE:
        for day in facts.by_day:
            updates = day.get("updates", 0)
            if updates == 0:
                # Captured separately as "missing_days" already; only
                # surface here if there was attendance that day (people
                # worked but didn't submit).
                attendance_day = next(
                    (a for a in facts.attendance_by_day if a["date"] == day["date"]),
                    None,
                )
                if attendance_day and attendance_day.get("signedInCount", 0) >= _MASS_MISSING_MIN_ACTIVE:
                    out.append({
                        "kind": "mass_missing_day",
                        "severity": "alert",
                        "title": f"No updates submitted on {day['date']}",
                        "detail": (
                            f"{attendance_day['signedInCount']} members worked "
                            f"on {day['date']} but nobody submitted a daily "
                            f"update."
                        ),
                    })
                continue
            ratio = updates / max(1, len(active_names))
            if ratio < _MASS_MISSING_PCT:
                out.append({
                    "kind": "mass_missing_day",
                    "severity": "alert",
                    "title": (
                        f"Only {updates} of {len(active_names)} members "
                        f"submitted on {day['date']}"
                    ),
                    "detail": (
                        f"Submission rate fell to "
                        f"{round(ratio * 100)}% on {day['date']}."
                    ),
                })

    # --- 6. Task mono-focus (per member) ---------------------------------
    # Compute hours-per-(member,task) from by_task + by_contributor by
    # walking task entries. We only have aggregate buckets so we
    # approximate: a member with > 10h whose top task ratio (their hours
    # divided by the task's hours when sole contributor) exceeds 80%.
    # Cheap heuristic; good enough until the repo exposes a per-member
    # task breakdown.
    for c in facts.by_contributor:
        if c["hours"] < _TASK_MONO_MIN_HOURS:
            continue
        # Find tasks where this contributor is the sole contributor
        # (contributors == 1) and rank by hours.
        sole_tasks = [
            t for t in facts.by_task if t.get("contributors") == 1
        ]
        if not sole_tasks:
            continue
        top_sole = max(sole_tasks, key=lambda t: t["hours"], default=None)
        if not top_sole:
            continue
        # Without a per-(member,task) lookup we can't be 100% certain
        # this top sole-task was THIS contributor's. Skip to avoid
        # false-positives; left as a TODO for when repo exposes that.

    return out


# ---------------------------------------------------------------------------
# AI-backed narrative layer
# ---------------------------------------------------------------------------

_FALLBACK_NARRATIVE = {
    "headline": "Weekly activity recorded.",
    "summary": "AI narrative is temporarily unavailable. The metrics above are accurate.",
    "highlights": [],
    "notable_patterns": [],
    "concerns": [],
}


def _format_anomalies_for_prompt(anomalies: list[dict]) -> str:
    """Render the anomaly list as plain text for the LLM. Returns
    "(none detected)" when empty so the prompt section never reads
    as missing context."""
    if not anomalies:
        return "(none detected)"
    lines = []
    for a in anomalies:
        sev = a.get("severity", "info").upper()
        title = a.get("title", "")
        detail = a.get("detail", "")
        lines.append(f"- [{sev}] {title} — {detail}")
    return "\n".join(lines)


def generate_weekly_narrative(facts: WeeklyFacts, team_size: int) -> dict:
    """Call Groq to wrap the deterministic facts in a short editorial summary.

    The prompt intentionally does NOT ask the model to re-compute numbers —
    those are computed in `aggregate()` and passed in as gospel. The model's
    only job is language: headline, 2–3 sentence recap, highlights, patterns,
    concerns. This keeps hallucinations scoped to prose, not figures.

    The prompt now covers all five dimensions (updates, attendance, activity,
    day-offs) so the narrative is a full weekly digest rather than an
    updates-only recap.
    """
    # Skip the API call only when every dimension is empty — otherwise we
    # still have a story to tell (e.g. "logged 42h but submitted no updates").
    no_data = (
        facts.total_updates == 0
        and facts.attendance_total_hours == 0
        and facts.activity_total_active_minutes == 0
        and facts.dayoffs_approved_count == 0
    )
    if no_data:
        return {
            "headline": "No activity recorded this week.",
            "summary": (
                f"{team_size} members in the workspace, but no task updates, "
                f"attendance sessions, activity, or approved day-offs were "
                f"recorded between {facts.start_date} and {facts.end_date}."
            ),
            "highlights": [],
            "notable_patterns": [],
            "concerns": [
                "Zero activity across every data source. Check whether the desktop app is deployed and members are running the timer.",
            ],
        }

    try:
        api_key = _get_api_key()
    except RuntimeError:
        return _FALLBACK_NARRATIVE

    top_contributors = facts.by_contributor[:5]
    top_tasks = facts.by_task[:8]
    top_attendance = facts.attendance_by_contributor[:5]
    top_apps = facts.activity_top_apps[:5]
    top_dayoffs = facts.dayoffs_requests[:6]

    contributor_lines = "\n".join(
        f"  - {c['name']}: {c['hours']}h across {c['updates']} update(s), {c['tasks']} distinct task(s)"
        for c in top_contributors
    ) or "  - (none)"

    task_lines = "\n".join(
        f"  - {t['task_name']}: {t['hours']}h ({t['contributors']} contributor(s))"
        for t in top_tasks
    ) or "  - (none)"

    attendance_lines = "\n".join(
        f"  - {c['name']}: {c['hours']}h over {c['sessions']} session(s)"
        for c in top_attendance
    ) or "  - (no timer sessions)"

    app_lines = "\n".join(
        f"  - {a['app_name']}: {a['minutes']}m"
        for a in top_apps
    ) or "  - (no desktop activity)"

    dayoff_lines = "\n".join(
        f"  - {d['name']}: {d['start_date']} → {d['end_date']} ({d['days_in_window']} day(s) in this week) — {d['reason'] or 'no reason given'}"
        for d in top_dayoffs
    ) or "  - (none approved for this week)"

    missing_line = (
        f"Days with zero updates: {', '.join(facts.missing_days)}"
        if facts.missing_days
        else "Updates submitted every day of the window."
    )

    # Update-vs-attendance gap is the single most interesting derived
    # signal for a manager — surface it in the prompt so the model can
    # mention it if worth calling out.
    hour_gap = round(facts.attendance_total_hours - facts.total_hours, 1)
    gap_line = (
        f"Self-reported hours vs timer hours gap: {hour_gap}h "
        f"({'updates under-report' if hour_gap > 0 else 'updates over-report' if hour_gap < 0 else 'aligned'})"
    )

    prompt = f"""You are summarising one week of team activity for a workspace owner.

## Window
{facts.start_date} to {facts.end_date}

## Task updates (self-reported)
- Total updates submitted: {facts.total_updates}
- Contributors: {facts.contributor_count} of {team_size} members
- Self-reported hours: {facts.total_hours}h
- {missing_line}

### Top contributors (by self-reported hours)
{contributor_lines}

### Top tasks / themes (by hours)
{task_lines}

## Attendance (objective timer sessions)
- Objective hours logged: {facts.attendance_total_hours}h across {facts.attendance_sessions_count} session(s)
- Members who clocked in: {facts.attendance_contributor_count} of {team_size}
- {gap_line}

### Top members by timer hours
{attendance_lines}

## Focus signals (desktop activity)
- Avg activity score across users: {facts.activity_avg_score}%
- Total active minutes: {facts.activity_total_active_minutes}m
- Total idle minutes: {facts.activity_total_idle_minutes}m
- Members tracked: {facts.activity_contributor_count}

### Top apps this week
{app_lines}

## Approved day-offs overlapping this week
- Approved requests: {facts.dayoffs_approved_count}
- Person-days of leave consumed: {facts.dayoffs_days_lost}

{dayoff_lines}

## Detected anomalies (deterministic, computed before this prompt)
{_format_anomalies_for_prompt(facts.anomalies)}

## Instructions
Respond with ONLY valid JSON (no markdown, no code blocks) in this exact shape:
{{
  "headline": "one crisp sentence summarising the week, no more than 100 characters",
  "summary": "3-4 sentence editorial recap covering task updates, tracked time, focus, and leave — written for a busy owner",
  "highlights": ["short bullet 1", "short bullet 2", "short bullet 3"],
  "notable_patterns": ["observation about the week's shape"],
  "concerns": ["any risks or gaps worth flagging"]
}}

Rules:
- Do NOT invent numbers. Only refer to figures present above.
- The summary MUST touch on more than one dimension (for example: updates + tracked time, or attendance + day-offs). Don't write an updates-only recap.
- highlights: 3–6 items. Mix across dimensions — a top task, a top contributor by timer hours, a notable focus score, a big-impact leave.
- notable_patterns: 0–3 items. Examples: "most work concentrated on Monday and Tuesday", "3-hour gap between self-reported and objective hours", "two members drove 70% of tracked time".
- concerns: 0–3 items. Examples: "two members submitted no updates despite 12h logged", "large leave window coincided with missing updates on the same days", "task X spans four contributors with no clear owner".
- If anomalies are listed above, ALWAYS reference at least one in either "concerns" or "highlights" — they were computed deterministically and are facts, not guesses. Use the human title of the anomaly verbatim or paraphrase it; don't invent new ones.
- Keep language professional. No slang, no emoji."""

    payload = json.dumps(
        {
            "model": GROQ_TEXT_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a concise team-operations analyst. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 700,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        GROQ_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "TaskFlow/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return _FALLBACK_NARRATIVE

    content = (result.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return _FALLBACK_NARRATIVE

    def _clamp_list(value, max_len: int, item_max_chars: int = 200) -> list[str]:
        if not isinstance(value, list):
            return []
        result: list[str] = []
        for entry in value[:max_len]:
            if isinstance(entry, str):
                result.append(entry[:item_max_chars])
        return result

    return {
        "headline": str(parsed.get("headline", ""))[:200],
        "summary": str(parsed.get("summary", ""))[:1000],
        "highlights": _clamp_list(parsed.get("highlights"), 6),
        "notable_patterns": _clamp_list(parsed.get("notable_patterns"), 4),
        "concerns": _clamp_list(parsed.get("concerns"), 4),
    }
