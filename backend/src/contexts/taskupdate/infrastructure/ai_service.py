"""AI service for weekly rollups.

Feeds the structured per-user daily-update records into Groq (LLaMA 3.3 70B)
and returns a digest an owner would actually want to read — headline summary,
top projects/themes, top contributors, notable patterns, concerns.

We reuse the Groq credential flow from the activity context so there's a
single secret, single caching layer, single code path for auth.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from contexts.activity.infrastructure.groq_service import (
    GROQ_API_URL,
    GROQ_MODEL,
    _get_api_key,  # re-used credential loader (cached, Secrets-Manager-aware)
)
from contexts.taskupdate.domain.entities import TaskUpdate


# ---------------------------------------------------------------------------
# Pure aggregation — no AI, deterministic. The AI only receives the result.
# ---------------------------------------------------------------------------

@dataclass
class WeeklyFacts:
    """Deterministic aggregations of the week's task updates.

    Kept in a dataclass (not a raw dict) so the shape is self-documenting
    and the handler can return these metrics verbatim — owners get reliable
    numbers even if Groq is degraded or offline.
    """
    start_date: str
    end_date: str
    total_updates: int
    contributor_count: int
    total_hours: float
    by_contributor: list[dict]  # [{ name, updates, hours, tasks }]
    by_task: list[dict]          # [{ task_name, hours, contributors, updates }]
    by_day: list[dict]           # [{ date, updates, hours }]
    missing_days: list[str]      # days in window with zero updates


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


def aggregate(
    updates: Iterable[TaskUpdate],
    start_date: str,
    end_date: str,
) -> WeeklyFacts:
    """Compute the deterministic slice the AI will summarise."""
    from datetime import date as date_cls, timedelta

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
    )


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


def generate_weekly_narrative(facts: WeeklyFacts, team_size: int) -> dict:
    """Call Groq to wrap the deterministic facts in a short editorial summary.

    The prompt intentionally does NOT ask the model to re-compute numbers —
    those are computed in `aggregate()` and passed in as gospel. The model's
    only job is language: headline, 2–3 sentence recap, highlights, patterns,
    concerns. This keeps hallucinations scoped to prose, not figures.
    """
    # When the workspace has nothing to summarise, don't spend a token.
    if facts.total_updates == 0:
        return {
            "headline": "No updates submitted this week.",
            "summary": (
                f"{team_size} members in the workspace, but no task updates "
                f"were submitted between {facts.start_date} and {facts.end_date}."
            ),
            "highlights": [],
            "notable_patterns": [],
            "concerns": [
                "Zero updates submitted. Check whether the desktop app is deployed and members are running the timer.",
            ],
        }

    try:
        api_key = _get_api_key()
    except RuntimeError:
        return _FALLBACK_NARRATIVE

    top_contributors = facts.by_contributor[:5]
    top_tasks = facts.by_task[:8]

    contributor_lines = "\n".join(
        f"  - {c['name']}: {c['hours']}h across {c['updates']} update(s), {c['tasks']} distinct task(s)"
        for c in top_contributors
    ) or "  - (no contributors)"

    task_lines = "\n".join(
        f"  - {t['task_name']}: {t['hours']}h ({t['contributors']} contributor(s))"
        for t in top_tasks
    ) or "  - (no tasks)"

    missing_line = (
        f"Days with zero updates: {', '.join(facts.missing_days)}"
        if facts.missing_days
        else "Updates submitted every day of the window."
    )

    prompt = f"""You are summarising one week of team activity for a workspace owner.

## Window
{facts.start_date} to {facts.end_date}

## Headline metrics
- Total updates submitted: {facts.total_updates}
- Contributors: {facts.contributor_count} of {team_size} members
- Total tracked time: {facts.total_hours}h
- {missing_line}

## Top contributors (by hours)
{contributor_lines}

## Top tasks / themes (by hours)
{task_lines}

## Instructions
Respond with ONLY valid JSON (no markdown, no code blocks) in this exact shape:
{{
  "headline": "one crisp sentence summarising the week, no more than 100 characters",
  "summary": "2-3 sentence editorial recap written for a busy owner",
  "highlights": ["short bullet 1", "short bullet 2", "short bullet 3"],
  "notable_patterns": ["observation about the week's shape"],
  "concerns": ["any risks or gaps worth flagging"]
}}

Rules:
- Do NOT invent numbers. Only refer to figures present above.
- highlights: 2–5 items, each grouped around a project / task theme or a specific outcome.
- notable_patterns: 0–3 items. Examples: "most work concentrated on Monday and Tuesday", "three contributors drove 80% of hours".
- concerns: 0–3 items. Examples: "two members submitted no updates this week", "task X spans four contributors with no clear owner".
- Keep language professional. No slang, no emoji."""

    payload = json.dumps(
        {
            "model": GROQ_MODEL,
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
