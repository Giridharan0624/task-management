"""Fill in attendance / task-updates / activity / summaries for the workdays
between the last seeded date (default 2026-04-22) and today (2026-04-29).
Uses the existing 26 users in the workspace (Owner + 25 employees).

Today's record is intentionally PARTIAL:
  - attendance has an open session (sign_in_at set, sign_out_at null)
  - activity buckets cover 9:00 -> current hour only
  - no task_update (those are end-of-day submissions)
  - no daily_summary (generated at end-of-day)

Usage:
  python scripts/populate_recent_days.py --dry-run
  python scripts/populate_recent_days.py --confirm
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import boto3


_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from seed_neurostack_staging import (  # type: ignore
    APPS, KEY_ACTIVITY_POOL, SUMMARY_OPENERS,
    build_attendance_item, build_taskupdate_item,
    iso_at, pick_weighted,
)


DEFAULT_REGION = "ap-south-1"
DEFAULT_TABLE = "TaskManagementTable-staging"
DEFAULT_ORG = "neurostack"
DEFAULT_START = "2026-04-22"
DEFAULT_TODAY = "2026-04-29"
DEFAULT_CDN = "d32wbqjdb87hcf.cloudfront.net"

RNG = random.Random(2027)


def workdays_in_range(start: str, end: str) -> list[str]:
    """Return YYYY-MM-DD for workdays (Mon-Fri) in [start, end] inclusive."""
    d0 = datetime.strptime(start, "%Y-%m-%d").date()
    d1 = datetime.strptime(end, "%Y-%m-%d").date()
    out = []
    cur = d0
    while cur <= d1:
        if cur.weekday() < 5:
            out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def list_org_users(table, org_id: str) -> list[dict]:
    """Scan all user profiles in the org. Returns dicts with the fields
    needed by the builders."""
    users: list[dict] = []
    pk_prefix = f"ORG#{org_id}#USER#"
    scan_kwargs = {
        "FilterExpression": "begins_with(PK, :pfx) AND SK = :sk",
        "ExpressionAttributeValues": {":pfx": pk_prefix, ":sk": "PROFILE"},
    }
    while True:
        resp = table.scan(**scan_kwargs)
        for it in resp.get("Items", []):
            users.append({
                "user_id": it.get("user_id", ""),
                "email": it.get("email", ""),
                "name": it.get("name", ""),
                "system_role": it.get("system_role", "MEMBER"),
                "employee_id": it.get("employee_id", ""),
            })
        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    return users


def sample_tasks(table, org_id: str, limit: int = 50) -> list[tuple[str, str, str, str]]:
    """Return up to `limit` (task_id, title, project_id, project_name).
    Used to source realistic task titles for taskupdates and the 'currently
    working on' field in attendance sessions."""
    out: list[tuple[str, str, str, str]] = []
    project_names: dict[str, str] = {}

    scan_kwargs = {
        "FilterExpression": "org_id = :org AND attribute_exists(task_id)",
        "ExpressionAttributeValues": {":org": org_id},
        "Limit": 200,
    }
    while True:
        resp = table.scan(**scan_kwargs)
        for it in resp.get("Items", []):
            if "task_id" in it and "title" in it and "project_id" in it:
                out.append((it["task_id"], it["title"], it["project_id"], ""))
            elif it.get("SK") == "METADATA" and "name" in it and "project_id" in it:
                project_names[it["project_id"]] = it["name"]
            if len(out) >= limit and project_names:
                break
        if len(out) >= limit and project_names:
            break
        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    # Fill in project_name from the project records we collected.
    enriched = []
    for tid, title, pid, _ in out:
        enriched.append((tid, title, pid, project_names.get(pid, "Sprint")))
    return enriched


# ---------------------------------------------------------------------------
# Today-specific builders (partial day)
# ---------------------------------------------------------------------------

def build_open_attendance(
    org_id: str, user_id: str, user_name: str, user_email: str,
    system_role: str, date: str, now_hour: int, now_minute: int,
    project_id: str, project_name: str, task_id: str, task_title: str,
) -> dict:
    """Today's attendance — sign-in this morning, still active. No sign_out."""
    base = datetime.fromisoformat(f"{date}T00:00:00+00:00")
    sign_in = base.replace(hour=9, minute=RNG.randint(0, 30))
    last_hb = base.replace(hour=now_hour, minute=now_minute)
    hours_so_far = round((last_hb - sign_in).total_seconds() / 3600, 2)
    if hours_so_far < 0:
        hours_so_far = 0.0
    sessions = [{
        "sign_in_at": iso_at(sign_in),
        # no sign_out_at — the open marker
        "task_id": task_id, "project_id": project_id,
        "task_title": task_title, "project_name": project_name,
        "description": "Currently working.",
        "last_heartbeat_at": iso_at(last_hb),
    }]
    return {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"ATTENDANCE#{date}",
        "GSI1PK": f"ORG#{org_id}#ATTENDANCE_DATE#{date}",
        "GSI1SK": f"USER#{user_id}",
        "org_id": org_id,
        "user_id": user_id,
        "date": date,
        "sessions": json.dumps(sessions),
        "total_hours": str(hours_so_far),
        "user_name": user_name,
        "user_email": user_email,
        "system_role": system_role,
    }


def build_partial_activity(
    org_id: str, user_id: str, user_name: str, user_email: str, date: str,
    now_hour: int, now_minute: int, screenshot_urls: list[str],
) -> dict:
    """Today's activity — buckets only from 9:00 to current time."""
    base = datetime.fromisoformat(f"{date}T00:00:00+00:00")
    start = base.replace(hour=9, minute=0)
    now_dt = base.replace(hour=now_hour, minute=now_minute)
    minutes_elapsed = max(0, int((now_dt - start).total_seconds() / 60))
    bucket_count = max(0, minutes_elapsed // 5)

    buckets = []
    app_usage: dict[str, int] = {}
    total_active = 0
    total_idle = 0
    for i in range(bucket_count):
        ts = start + timedelta(minutes=5 * i)
        active_s = RNG.randint(180, 295)
        idle_s = 300 - active_s
        top_app = pick_weighted(APPS)
        breakdown = {top_app: RNG.randint(120, active_s)}
        remaining = active_s - breakdown[top_app]
        if remaining > 0:
            second = pick_weighted(APPS)
            if second == top_app:
                second = RNG.choice([a[0] for a in APPS if a[0] != top_app])
            breakdown[second] = remaining
        for a, s in breakdown.items():
            app_usage[a] = app_usage.get(a, 0) + s
        screenshot_url = (
            RNG.choice(screenshot_urls) if (screenshot_urls and RNG.random() < 0.25) else None
        )
        buckets.append({
            "timestamp": iso_at(ts),
            "keyboard_count": RNG.randint(40, 480),
            "mouse_count": RNG.randint(30, 220),
            "active_seconds": active_s,
            "idle_seconds": idle_s,
            "top_app": top_app,
            "app_breakdown": breakdown,
            "screenshot_url": screenshot_url,
        })
        total_active += active_s
        total_idle += idle_s

    return {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"ACTIVITY#{date}",
        "GSI1PK": f"ORG#{org_id}#ACTIVITY_DATE#{date}",
        "GSI1SK": f"USER#{user_id}",
        "org_id": org_id,
        "user_id": user_id,
        "date": date,
        "buckets": json.dumps(buckets),
        "total_active_minutes": str(round(total_active / 60, 1)),
        "total_idle_minutes": str(round(total_idle / 60, 1)),
        "app_usage": json.dumps(app_usage),
        "user_name": user_name,
        "user_email": user_email,
    }


# ---------------------------------------------------------------------------
# Reuse the screenshot-aware activity builder for completed past days.
# ---------------------------------------------------------------------------

def build_full_activity(
    org_id: str, user_id: str, user_name: str, user_email: str, date: str,
    screenshot_urls: list[str],
) -> tuple[dict, dict]:
    """Full-day activity (96 buckets) + summary."""
    bucket_count = 96
    start = datetime.fromisoformat(f"{date}T09:00:00+00:00")
    buckets = []
    app_usage: dict[str, int] = {}
    total_active = 0
    total_idle = 0
    for i in range(bucket_count):
        ts = start + timedelta(minutes=5 * i)
        active_s = RNG.randint(180, 295)
        idle_s = 300 - active_s
        top_app = pick_weighted(APPS)
        breakdown = {top_app: RNG.randint(120, active_s)}
        remaining = active_s - breakdown[top_app]
        if remaining > 0:
            second = pick_weighted(APPS)
            if second == top_app:
                second = RNG.choice([a[0] for a in APPS if a[0] != top_app])
            breakdown[second] = remaining
        for a, s in breakdown.items():
            app_usage[a] = app_usage.get(a, 0) + s
        screenshot_url = (
            RNG.choice(screenshot_urls) if (screenshot_urls and RNG.random() < 0.25) else None
        )
        buckets.append({
            "timestamp": iso_at(ts),
            "keyboard_count": RNG.randint(40, 480),
            "mouse_count": RNG.randint(30, 220),
            "active_seconds": active_s,
            "idle_seconds": idle_s,
            "top_app": top_app,
            "app_breakdown": breakdown,
            "screenshot_url": screenshot_url,
        })
        total_active += active_s
        total_idle += idle_s

    activity_item = {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"ACTIVITY#{date}",
        "GSI1PK": f"ORG#{org_id}#ACTIVITY_DATE#{date}",
        "GSI1SK": f"USER#{user_id}",
        "org_id": org_id,
        "user_id": user_id,
        "date": date,
        "buckets": json.dumps(buckets),
        "total_active_minutes": str(round(total_active / 60, 1)),
        "total_idle_minutes": str(round(total_idle / 60, 1)),
        "app_usage": json.dumps(app_usage),
        "user_name": user_name,
        "user_email": user_email,
    }

    top_apps = sorted(app_usage.items(), key=lambda kv: kv[1], reverse=True)[:3]
    summary_text = RNG.choice(SUMMARY_OPENERS) + ", ".join(a for a, _ in top_apps) + (
        f". Active {round(total_active / 60)}m vs idle {round(total_idle / 60)}m — a healthy focus ratio."
    )
    summary_item = {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"SUMMARY#{date}",
        "org_id": org_id,
        "user_id": user_id,
        "date": date,
        "summary": summary_text,
        "key_activities": json.dumps(RNG.sample(KEY_ACTIVITY_POOL, k=RNG.randint(3, 5))),
        "productivity_score": RNG.randint(6, 9),
        "concerns": json.dumps([]),
        "total_active_minutes": str(round(total_active / 60, 1)),
        "total_idle_minutes": str(round(total_idle / 60, 1)),
        "app_usage": json.dumps(app_usage),
        "generated_at": f"{date}T19:00:00+00:00",
        "user_name": user_name,
    }
    return activity_item, summary_item


def fetch_user_screenshots(s3_client, bucket: str, org_id: str, user_id: str, cdn: str) -> list[str]:
    """List existing screenshots for this user under their tenant prefix
    and return their CDN URLs. Falls back to empty list if none."""
    prefix = f"orgs/{org_id}/screenshots/{user_id}/"
    try:
        resp = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=10)
    except Exception:
        return []
    return [f"https://{cdn}/{obj['Key']}" for obj in resp.get("Contents", [])]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--org-id", default=DEFAULT_ORG)
    p.add_argument("--start-date", default=DEFAULT_START,
                   help="first workday to fill (default 2026-04-22)")
    p.add_argument("--today", default=DEFAULT_TODAY,
                   help="today's date (default 2026-04-29) — partial day")
    p.add_argument("--now-hour", type=int, default=14,
                   help="current hour (24h) for today's open session (default 14)")
    p.add_argument("--now-minute", type=int, default=30)
    p.add_argument("--bucket", default="taskflow-uploads-staging")
    p.add_argument("--cdn", default=DEFAULT_CDN)
    p.add_argument("--table", default=DEFAULT_TABLE)
    p.add_argument("--region", default=DEFAULT_REGION)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--confirm", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.confirm:
        args.dry_run = False
    if "staging" not in args.table.lower():
        print("REFUSING: not staging.", file=sys.stderr)
        return 2

    session = boto3.Session(region_name=args.region)
    table = session.resource("dynamodb").Table(args.table)
    s3 = session.client("s3")

    print(f"=== populate_recent_days ({'DRY-RUN' if args.dry_run else 'LIVE'}) ===")
    print(f"  Org      : {args.org_id}")
    print(f"  Range    : {args.start_date} -> {args.today}")
    print(f"  Now      : {args.now_hour:02d}:{args.now_minute:02d}")
    print()

    print("Listing existing users in org ...")
    users = list_org_users(table, args.org_id)
    print(f"  {len(users)} users")
    if not users:
        print("ERROR: no users found", file=sys.stderr)
        return 2
    print()

    print("Sampling tasks for taskupdate references ...")
    tasks = sample_tasks(table, args.org_id, limit=80)
    print(f"  {len(tasks)} tasks")
    print()

    full_days = workdays_in_range(args.start_date, args.today)
    if args.today in full_days:
        full_days.remove(args.today)
    today_str = args.today
    print(f"Workdays to fill (full): {full_days}")
    print(f"Today (partial): {today_str}")
    print()

    # Pre-fetch each user's screenshot URLs once.
    print("Fetching screenshot URLs per user ...")
    user_screens: dict[str, list[str]] = {}
    for u in users:
        urls = fetch_user_screenshots(s3, args.bucket, args.org_id, u["user_id"], args.cdn)
        user_screens[u["user_id"]] = urls
    total_screens = sum(len(v) for v in user_screens.values())
    print(f"  found {total_screens} screenshot URLs across {len(users)} users")
    print()

    attendance_items: list[dict] = []
    taskupdate_items: list[dict] = []
    activity_items: list[dict] = []
    summary_items: list[dict] = []

    for u in users:
        # Pull a random task for this user's "currently working on" context.
        # Just use a random sampled task — strict assignment isn't needed.
        title_pool = [t[1] for t in tasks] if tasks else ["Sprint planning", "Code review"]

        for d in full_days:
            if RNG.random() < 0.05:
                continue  # rare sick day
            sample = RNG.choice(tasks) if tasks else ("sprint-general", "Sprint planning", "DIRECT", "Sprint")
            t_id, t_title, t_proj_id, t_proj_name = sample
            attendance_items.append(build_attendance_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], user_email=u["email"],
                system_role=u["system_role"], date=d,
                project_id=t_proj_id, project_name=t_proj_name,
                task_id=t_id, task_title=t_title,
            ))
            taskupdate_items.append(build_taskupdate_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], employee_id=u["employee_id"],
                date=d, task_titles=title_pool,
            ))
            act, summ = build_full_activity(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], user_email=u["email"], date=d,
                screenshot_urls=user_screens.get(u["user_id"], []),
            )
            activity_items.append(act)
            summary_items.append(summ)

        # Today — partial: open attendance + partial activity, no taskupdate, no summary.
        sample = RNG.choice(tasks) if tasks else ("sprint-general", "Sprint planning", "DIRECT", "Sprint")
        t_id, t_title, t_proj_id, t_proj_name = sample
        attendance_items.append(build_open_attendance(
            org_id=args.org_id, user_id=u["user_id"],
            user_name=u["name"], user_email=u["email"],
            system_role=u["system_role"], date=today_str,
            now_hour=args.now_hour, now_minute=args.now_minute,
            project_id=t_proj_id, project_name=t_proj_name,
            task_id=t_id, task_title=t_title,
        ))
        activity_items.append(build_partial_activity(
            org_id=args.org_id, user_id=u["user_id"],
            user_name=u["name"], user_email=u["email"], date=today_str,
            now_hour=args.now_hour, now_minute=args.now_minute,
            screenshot_urls=user_screens.get(u["user_id"], []),
        ))

    print(f"Built items:")
    print(f"  attendance   : {len(attendance_items)}  ({len(users)} for today, rest for past days)")
    print(f"  task-updates : {len(taskupdate_items)}  (no entries for today)")
    print(f"  activity     : {len(activity_items)}    ({len(users)} partial for today)")
    print(f"  summaries    : {len(summary_items)}    (no summary for today)")
    print()

    def _write(label: str, items: list[dict]) -> int:
        if args.dry_run:
            return len(items)
        with table.batch_writer() as batch:
            for it in items:
                batch.put_item(Item=it)
        print(f"  wrote {len(items)} {label}")
        return len(items)

    print("Writing to DynamoDB ...")
    total = 0
    total += _write("attendance", attendance_items)
    total += _write("task-update", taskupdate_items)
    total += _write("activity", activity_items)
    total += _write("daily-summary", summary_items)

    verb = "would write" if args.dry_run else "wrote"
    print()
    print(f"=== Summary: {total} items {verb} ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
