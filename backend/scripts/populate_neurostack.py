"""Populate the existing `neurostack` workspace on STAGING with 25 employees,
5 projects, two weeks of attendance / task-updates / activity / day-offs,
and real screenshot uploads to S3.

Assumes the workspace already exists (Owner already created via
create_workspace.py). The owner is looked up by email — NOT recreated.

Usage:
  python scripts/populate_neurostack.py --dry-run
  python scripts/populate_neurostack.py --confirm

Options:
  --owner-email    email of the existing Owner (default: taskflow@neurostack.demo)
  --password       shared password for the 25 new users (default: Demo1234!)
  --end-date       last day of history (default: 2026-04-21)
  --history-days   calendar days back (workdays kept) (default: 14)
"""
from __future__ import annotations

import argparse
import io
import json
import os
import random
import struct
import sys
import uuid
import zlib
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError


_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from seed_neurostack_staging import (  # type: ignore
    APPS,
    COMMENT_TEMPLATES,
    DAYOFF_REASONS,
    KEY_ACTIVITY_POOL,
    SUMMARY_OPENERS,
    TASK_STATUSES,
    TASK_TITLES,
    STATUS_WEIGHTS,
    build_attendance_item,
    build_comment_item,
    build_dayoff_item,
    build_member_item,
    build_project_item,
    build_task_item,
    build_taskupdate_item,
    build_user_item,
    create_cognito_user,
    iso_at,
    iso_now,
    pick_weighted,
    pick_weighted_status,
    resolve_pool_id,
    workdays,
)


DEFAULT_REGION = "ap-south-1"
DEFAULT_TABLE = "TaskManagementTable-staging"
DEFAULT_POOL_NAME = "TaskManagementUserPool-staging"
DEFAULT_BUCKET = "taskflow-uploads-staging"
DEFAULT_CDN = "d32wbqjdb87hcf.cloudfront.net"
DEFAULT_ORG = "neurostack"
DEFAULT_OWNER_EMAIL = "taskflow@neurostack.demo"
DEFAULT_PASSWORD = "Demo1234!"
DEFAULT_END_DATE = "2026-04-21"
DEFAULT_HISTORY_DAYS = 14
EMAIL_DOMAIN = "neurostack.demo"

RNG = random.Random(2026)


# ---------------------------------------------------------------------------
# 25 users — 5 admins + 20 members. American names. All optional fields filled.
# Tuple: (first, last, designation, department, dob_m, dob_d,
#         phone, location, bio, college, area_of_interest, hobby, skills)
# ---------------------------------------------------------------------------

_PEOPLE: list[tuple] = [
    # 5 ADMINS (idx 1-5)
    ("Liam", "Anderson", "VP of Engineering", "Engineering", 6, 22,
     "+1-415-555-0102", "San Francisco, CA", "Engineering leader; built and scaled distributed systems.",
     "Stanford University", "Distributed systems", "Trail running",
     ["Go", "Kubernetes", "System design", "Mentoring"]),
    ("Olivia", "Parker", "Head of Product", "Product", 9, 5,
     "+1-212-555-0118", "New York, NY", "Product leader focused on B2B SaaS.",
     "Cornell University", "Customer research", "Photography",
     ["Roadmap", "User interviews", "Pricing", "Strategy"]),
    ("Noah", "Mitchell", "Head of Design", "Design", 11, 30,
     "+1-512-555-0145", "Austin, TX", "Brand and product design generalist.",
     "Rhode Island School of Design", "Type and identity", "Cycling",
     ["Figma", "Brand systems", "Typography", "Prototyping"]),
    ("Ava", "Bennett", "Head of People", "People", 2, 18,
     "+1-617-555-0173", "Boston, MA", "People ops and culture builder.",
     "Boston College", "Workplace culture", "Yoga",
     ["Onboarding", "Performance", "Comp design", "Coaching"]),
    ("Ethan", "Walker", "Director of Marketing", "Marketing", 7, 10,
     "+1-310-555-0188", "Los Angeles, CA", "Growth marketer; loves clear positioning.",
     "USC", "B2B positioning", "Surfing",
     ["SEO", "Content", "Lifecycle", "Analytics"]),
    # 20 MEMBERS (idx 6-25)
    ("Mia", "Carter", "Staff Software Engineer", "Engineering", 4, 27,
     "+1-415-555-0210", "Oakland, CA", "Backend systems and reliability.",
     "UC Berkeley", "Database internals", "Bouldering",
     ["Python", "PostgreSQL", "Observability", "Testing"]),
    ("Lucas", "Hughes", "Senior Software Engineer", "Engineering", 8, 3,
     "+1-206-555-0227", "Seattle, WA", "Full-stack with a backend lean.",
     "University of Washington", "Type systems", "Hiking",
     ["TypeScript", "React", "Go", "GraphQL"]),
    ("Isabella", "Foster", "Senior Software Engineer", "Engineering", 1, 15,
     "+1-512-555-0245", "Austin, TX", "API design and developer experience.",
     "UT Austin", "Developer tools", "Pottery",
     ["Python", "FastAPI", "OpenAPI", "Docs"]),
    ("Mason", "Brooks", "Senior Software Engineer", "Engineering", 12, 11,
     "+1-303-555-0263", "Denver, CO", "Frontend with a design eye.",
     "Colorado State University", "Animation", "Skiing",
     ["React", "Framer Motion", "CSS", "Accessibility"]),
    ("Charlotte", "Reed", "Software Engineer", "Engineering", 5, 26,
     "+1-512-555-0282", "Austin, TX", "Builder, recently shipped first prod feature.",
     "Texas A&M", "WebAssembly", "Board games",
     ["TypeScript", "React", "Node"]),
    ("Logan", "Murphy", "Software Engineer", "Engineering", 10, 8,
     "+1-617-555-0301", "Cambridge, MA", "Quiet contributor, deep code reviews.",
     "MIT", "Compilers", "Chess",
     ["Rust", "C++", "LLVM"]),
    ("Harper", "Cooper", "Software Engineer", "Engineering", 3, 29,
     "+1-415-555-0319", "San Francisco, CA", "Pragmatic engineer.",
     "Cal Poly", "Performance", "Rock climbing",
     ["Go", "Kubernetes", "gRPC"]),
    ("Benjamin", "Hayes", "Software Engineer", "Engineering", 6, 6,
     "+1-718-555-0338", "Brooklyn, NY", "Loves shipping the small daily improvements.",
     "NYU", "Dev productivity", "Running",
     ["TypeScript", "Next.js", "Vercel"]),
    ("Amelia", "Torres", "Software Engineer", "Engineering", 2, 9,
     "+1-786-555-0356", "Miami, FL", "Backend, ETL pipelines.",
     "University of Miami", "Streaming data", "Salsa dancing",
     ["Python", "Kafka", "Airflow"]),
    ("Jackson", "Russell", "Software Engineer", "Engineering", 9, 17,
     "+1-415-555-0374", "Palo Alto, CA", "DevOps and infra.",
     "Carnegie Mellon", "Reliability", "Climbing",
     ["Terraform", "AWS", "CI/CD"]),
    ("Sophia", "Diaz", "Senior Product Designer", "Design", 11, 2,
     "+1-512-555-0392", "Austin, TX", "Product design with a research lean.",
     "ArtCenter College of Design", "Service design", "Pottery",
     ["Figma", "Research", "Prototyping"]),
    ("Aiden", "Coleman", "Product Designer", "Design", 4, 12,
     "+1-310-555-0411", "Santa Monica, CA", "Visual systems and components.",
     "ArtCenter College of Design", "Components", "Photography",
     ["Figma", "Storybook", "CSS"]),
    ("Scarlett", "Sanders", "Visual Designer", "Design", 7, 21,
     "+1-212-555-0430", "New York, NY", "Brand and motion.",
     "School of Visual Arts", "Motion", "Drawing",
     ["After Effects", "Illustrator", "Branding"]),
    ("Henry", "Powell", "Senior Product Manager", "Product", 8, 28,
     "+1-415-555-0449", "San Francisco, CA", "PM for the platform team.",
     "Northwestern University", "Pricing experiments", "Hiking",
     ["Roadmap", "Discovery", "SQL"]),
    ("Evelyn", "Patterson", "Product Manager", "Product", 5, 4,
     "+1-617-555-0468", "Boston, MA", "PM for the dashboard team.",
     "Yale University", "User interviews", "Cooking",
     ["Roadmap", "Research", "Specs"]),
    ("Daniel", "Morgan", "Senior QA Engineer", "Quality", 1, 23,
     "+1-512-555-0486", "Austin, TX", "Test infrastructure.",
     "UT Austin", "Test design", "Chess",
     ["Python", "Playwright", "CI"]),
    ("Luna", "Rivera", "QA Engineer", "Quality", 10, 19,
     "+1-303-555-0505", "Boulder, CO", "End-to-end testing across web and desktop.",
     "University of Colorado", "Test automation", "Skiing",
     ["Playwright", "Pytest", "Test design"]),
    ("Samuel", "Bryant", "QA Engineer", "Quality", 12, 7,
     "+1-415-555-0524", "Oakland, CA", "API and contract testing.",
     "San Jose State University", "API contracts", "Cycling",
     ["Pytest", "Postman", "Schemathesis"]),
    ("Lily", "Wells", "HR Business Partner", "People", 3, 1,
     "+1-617-555-0542", "Cambridge, MA", "HRBP for engineering.",
     "Boston University", "Engagement", "Reading",
     ["Onboarding", "Coaching", "Comp"]),
    ("Caleb", "Dalton", "Content Marketing Manager", "Marketing", 3, 18,
     "+1-737-555-0560", "Austin, TX", "Long-form content and SEO.",
     "Vanderbilt University", "Long-form writing", "Tennis",
     ["SEO", "Content", "Editorial"]),
]
assert len(_PEOPLE) == 25


# ---------------------------------------------------------------------------
# Five projects.
# ---------------------------------------------------------------------------

PROJECTS_5: list[dict] = [
    {
        "name": "Payments Platform V2",
        "description": "Rewrite of the legacy payments service onto the new event bus. Stripe Connect, multi-currency, SCA-compliant checkout.",
        "domain": "DEVELOPMENT",
        "estimated": 4200.0,
    },
    {
        "name": "Customer Dashboard Redesign",
        "description": "End-to-end redesign of the customer-facing analytics dashboard. Faster time-to-insight, mobile-first, accessible color tokens.",
        "domain": "DESIGNING",
        "estimated": 1800.0,
    },
    {
        "name": "Mobile App Launch Q2",
        "description": "Native iOS + Android launch covering core timer, task inbox, and offline sync. Pilot at 500 users; public launch mid-June.",
        "domain": "DEVELOPMENT",
        "estimated": 3600.0,
    },
    {
        "name": "SOC 2 Readiness 2026",
        "description": "Controls inventory, evidence collection, tabletop exercises, and auditor scheduling. Letter of attestation by end of Q3.",
        "domain": "MANAGEMENT",
        "estimated": 900.0,
    },
    {
        "name": "AI Recommendations Research",
        "description": "Evaluate foundation-model options for product recommendations. Produce ROI memo + reference pipeline.",
        "domain": "RESEARCH",
        "estimated": 650.0,
    },
]


# ---------------------------------------------------------------------------
# Existing-owner lookup
# ---------------------------------------------------------------------------

def find_owner_sub(cognito, pool_id: str, email: str, org_id: str) -> str:
    """Look up an existing Cognito user by email and return their sub.

    Filters strictly by email — Cognito's server-side filter supports it
    natively, so we don't need to list every user in the pool.
    """
    resp = cognito.list_users(
        UserPoolId=pool_id,
        Filter=f'email = "{email}"',
        Limit=10,
    )
    for u in resp.get("Users", []):
        attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
        if attrs.get("custom:orgId") != org_id:
            continue
        return attrs.get("sub", "")
    raise RuntimeError(f"Owner with email {email!r} not found in org {org_id!r}")


# ---------------------------------------------------------------------------
# Screenshot generation — minimal valid PNGs without PIL.
# Generates a small (320x200) solid-color rectangle PNG with a tiny color
# variation per file so they're not byte-identical.
# ---------------------------------------------------------------------------

def make_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    """Return a minimal valid PNG of the given size and color.

    Uses only stdlib (struct + zlib). Output is small enough for fast
    upload (~600 bytes for 320x200)."""
    def _chunk(typ: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(typ + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = bytearray()
    row = bytes(rgb) * width
    for _ in range(height):
        raw.append(0)  # filter byte: None
        raw.extend(row)
    idat_data = zlib.compress(bytes(raw), 9)
    return sig + _chunk(b"IHDR", ihdr_data) + _chunk(b"IDAT", idat_data) + _chunk(b"IEND", b"")


# ---------------------------------------------------------------------------
# Activity bucket builder with optional screenshot URLs.
# ---------------------------------------------------------------------------

def build_activity_with_screenshots(
    org_id: str, user_id: str, user_name: str, user_email: str, date: str,
    user_screenshot_urls: list[str],
) -> tuple[dict, dict]:
    """Like seed_neurostack_staging.build_activity_item but ~25% of buckets
    reference a real screenshot URL drawn from `user_screenshot_urls`."""
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
        app_breakdown = {top_app: RNG.randint(120, active_s)}
        remaining = active_s - app_breakdown[top_app]
        if remaining > 0:
            second = pick_weighted(APPS)
            if second == top_app:
                second = RNG.choice([a[0] for a in APPS if a[0] != top_app])
            app_breakdown[second] = remaining
        for a, s in app_breakdown.items():
            app_usage[a] = app_usage.get(a, 0) + s

        # 25% chance this bucket has a screenshot
        screenshot_url = None
        if user_screenshot_urls and RNG.random() < 0.25:
            screenshot_url = RNG.choice(user_screenshot_urls)

        buckets.append({
            "timestamp": iso_at(ts),
            "keyboard_count": RNG.randint(40, 480),
            "mouse_count": RNG.randint(30, 220),
            "active_seconds": active_s,
            "idle_seconds": idle_s,
            "top_app": top_app,
            "app_breakdown": app_breakdown,
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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--org-id", default=DEFAULT_ORG)
    p.add_argument("--owner-email", default=DEFAULT_OWNER_EMAIL)
    p.add_argument("--password", default=DEFAULT_PASSWORD)
    p.add_argument("--end-date", default=DEFAULT_END_DATE)
    p.add_argument("--history-days", type=int, default=DEFAULT_HISTORY_DAYS)
    p.add_argument("--table", default=DEFAULT_TABLE)
    p.add_argument("--pool-name", default=DEFAULT_POOL_NAME)
    p.add_argument("--bucket", default=DEFAULT_BUCKET)
    p.add_argument("--cdn", default=DEFAULT_CDN)
    p.add_argument("--region", default=DEFAULT_REGION)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--confirm", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.confirm:
        args.dry_run = False

    if "staging" not in args.table.lower() or "staging" not in args.pool_name.lower():
        print("REFUSING: not staging.", file=sys.stderr)
        return 2

    session = boto3.Session(region_name=args.region)
    table = session.resource("dynamodb").Table(args.table)
    cognito = session.client("cognito-idp")
    s3 = session.client("s3")

    print(f"=== populate_neurostack ({'DRY-RUN' if args.dry_run else 'LIVE'}) ===")
    print(f"  Region    : {args.region}")
    print(f"  Table     : {args.table}")
    print(f"  Pool      : {args.pool_name}")
    print(f"  Bucket    : {args.bucket}")
    print(f"  Org       : {args.org_id}")
    print(f"  Owner     : {args.owner_email}")
    print(f"  End date  : {args.end_date}, history days: {args.history_days}")
    print()

    pool_id = resolve_pool_id(cognito, args.pool_name)
    if pool_id is None:
        print(f"ERROR: pool {args.pool_name!r} not found", file=sys.stderr)
        return 2
    print(f"Pool id: {pool_id}")

    print(f"Looking up existing Owner by email ...")
    owner_sub = find_owner_sub(cognito, pool_id, args.owner_email, args.org_id)
    print(f"  owner sub: {owner_sub}")
    print()

    now = iso_now()
    dates = workdays(args.end_date, args.history_days)
    print(f"Workdays: {len(dates)} ({dates[0]} -> {dates[-1]})")
    print()

    # ---- Step 1: Cognito users (5 admins + 20 members) -------
    print(f"Step 1: create {len(_PEOPLE)} Cognito users (5 ADMIN + 20 MEMBER)")
    user_records: list[dict] = []
    user_items: list[dict] = []

    for idx, p in enumerate(_PEOPLE, start=1):
        first, last, desig, dept, dob_m, dob_d, phone, location, bio, college, aoi, hobby, skills = p
        email = f"{first.lower()}.{last.lower()}@{EMAIL_DOMAIN}"
        name = f"{first} {last}"
        # Owner already has EMP-001; we start at EMP-002
        employee_id = f"EMP-{idx + 1:03d}"
        system_role = "ADMIN" if idx <= 5 else "MEMBER"

        if args.dry_run:
            user_id = f"dry-sub-{idx:02d}-{uuid.uuid4().hex[:8]}"
        else:
            try:
                user_id = create_cognito_user(
                    cognito, pool_id, email, name, system_role,
                    args.org_id, employee_id, args.password,
                )
            except ClientError as e:
                print(f"  FAILED {email}: {e.response['Error'].get('Message', e)}", file=sys.stderr)
                return 3

        user_records.append({
            "user_id": user_id, "employee_id": employee_id, "email": email,
            "name": name, "system_role": system_role, "department": dept,
            "designation": desig, "phone": phone, "location": location,
            "bio": bio, "college": college, "aoi": aoi, "hobby": hobby,
            "skills": skills, "dob_m": dob_m, "dob_d": dob_d,
        })

        # Build full user item with all optional fields populated
        item = build_user_item(
            org_id=args.org_id, user_id=user_id, employee_id=employee_id,
            email=email, name=name, system_role=system_role,
            designation=desig, department=dept,
            dob_month=dob_m, dob_day=dob_d, created_by=owner_sub, now=now,
        )
        # Fill in the extra optional fields the seed builder doesn't set
        item["phone"] = phone
        item["location"] = location
        item["bio"] = bio
        item["college_name"] = college
        item["area_of_interest"] = aoi
        item["hobby"] = hobby
        item["skills"] = json.dumps(skills)
        user_items.append(item)

        if not args.dry_run and idx % 5 == 0:
            print(f"  ... {idx} users created")

    print(f"  done ({len(user_records)} users)")
    print()

    # ---- Step 2: screenshot uploads ----
    print("Step 2: upload one screenshot per user to S3")
    user_screenshot_urls: dict[str, list[str]] = {}
    if args.dry_run:
        print(f"  would upload {len(user_records)} screenshots to s3://{args.bucket}/orgs/{args.org_id}/screenshots/...")
        for u in user_records:
            user_screenshot_urls[u["user_id"]] = [f"https://{args.cdn}/orgs/{args.org_id}/screenshots/{u['user_id']}/dry-{uuid.uuid4().hex[:8]}.png"]
    else:
        for u in user_records:
            urls: list[str] = []
            # 3 screenshots per user, each a slightly different shade
            for j in range(3):
                rgb = (
                    50 + (hash(u["user_id"] + str(j)) & 0xFF) % 150,
                    80 + (hash(u["user_id"] + str(j) + "g") & 0xFF) % 120,
                    120 + (hash(u["user_id"] + str(j) + "b") & 0xFF) % 100,
                )
                png_bytes = make_png(320, 200, rgb)
                file_id = uuid.uuid4().hex
                key = f"orgs/{args.org_id}/screenshots/{u['user_id']}/{file_id}.png"
                s3.put_object(
                    Bucket=args.bucket, Key=key, Body=png_bytes,
                    ContentType="image/png",
                )
                urls.append(f"https://{args.cdn}/{key}")
            user_screenshot_urls[u["user_id"]] = urls
        print(f"  uploaded {sum(len(v) for v in user_screenshot_urls.values())} screenshots")
    print()

    # ---- Step 3: projects + members ----
    print(f"Step 3: build {len(PROJECTS_5)} projects + members")
    project_items: list[dict] = []
    member_items: list[dict] = []
    project_members_map: dict[str, list[str]] = {}
    project_info_map: dict[str, dict] = {}

    admins_pool = [u for u in user_records if u["system_role"] == "ADMIN"]
    seniors_pool = [u for u in user_records if "Senior" in u["designation"] or "Staff" in u["designation"]]

    for p_idx, project in enumerate(PROJECTS_5, start=1):
        project_id = f"proj-{p_idx:02d}-{uuid.uuid4().hex[:8]}"
        project_info_map[project_id] = {**project, "project_id": project_id}
        # Creator: cycle through admins (or owner)
        creator_sub = admins_pool[p_idx % len(admins_pool)]["user_id"]
        project_items.append(build_project_item(args.org_id, project_id, project, creator_sub, now))

        # 8-12 members per project
        members = RNG.sample(user_records, k=RNG.randint(8, 12))
        project_members_map[project_id] = [m["user_id"] for m in members]

        # PROJECT_MANAGER = an admin; TEAM_LEAD = a senior IC
        pm = RNG.choice(admins_pool)
        tl = RNG.choice(seniors_pool) if seniors_pool else RNG.choice(user_records)
        roles_taken = {pm["user_id"], tl["user_id"]}

        member_items.append(build_member_item(
            args.org_id, project_id, pm["user_id"], "PROJECT_MANAGER", creator_sub, now))
        member_items.append(build_member_item(
            args.org_id, project_id, tl["user_id"], "TEAM_LEAD", creator_sub, now))

        if pm["user_id"] not in project_members_map[project_id]:
            project_members_map[project_id].append(pm["user_id"])
        if tl["user_id"] not in project_members_map[project_id]:
            project_members_map[project_id].append(tl["user_id"])
        for m in members:
            if m["user_id"] in roles_taken:
                continue
            member_items.append(build_member_item(
                args.org_id, project_id, m["user_id"], "MEMBER", creator_sub, now))
    print(f"  {len(project_items)} projects, {len(member_items)} memberships")
    print()

    # ---- Step 4: tasks + comments ----
    print("Step 4: build tasks + comments")
    task_items: list[dict] = []
    comment_items: list[dict] = []
    user_tasks_map: dict[str, list[tuple[str, str, str]]] = {u["user_id"]: [] for u in user_records}

    for project_id, project in project_info_map.items():
        domain = project["domain"]
        titles = TASK_TITLES[domain]
        count = RNG.randint(30, 40)
        members = project_members_map[project_id]
        creator_sub = admins_pool[0]["user_id"]
        for _ in range(count):
            task_id = f"task-{uuid.uuid4().hex[:12]}"
            title = RNG.choice(titles)
            desc = (
                f"{title}. Scope covers initial implementation, tests, and rollout. "
                f"Linked to the {project['name']} sprint objectives."
            )
            status = pick_weighted_status(domain)
            priority = RNG.choices(["LOW", "MEDIUM", "HIGH"], weights=[0.2, 0.55, 0.25])[0]
            n_assignees = RNG.randint(1, 3)
            assigned = RNG.sample(members, k=min(n_assignees, len(members)))
            deadline_day = datetime.strptime(args.end_date, "%Y-%m-%d").date() + timedelta(days=RNG.randint(-7, 21))
            est_hours = round(RNG.uniform(2, 24), 1)
            created_at = iso_at(datetime.fromisoformat(args.end_date + "T00:00:00+00:00")
                                - timedelta(days=RNG.randint(3, 21)))
            task_items.append(build_task_item(
                org_id=args.org_id, task_id=task_id, project_id=project_id,
                title=title, description=desc, status=status, priority=priority,
                domain=domain, assigned_to=assigned, assigned_by=creator_sub,
                created_by=creator_sub, deadline=deadline_day.isoformat(),
                estimated_hours=est_hours, created_at=created_at, updated_at=created_at,
            ))
            for a in assigned:
                user_tasks_map[a].append((title, project_id, project["name"]))

            for _ in range(RNG.randint(1, 3)):
                author = RNG.choice(assigned + [creator_sub])
                msg = RNG.choice(COMMENT_TEMPLATES)
                c_created = iso_at(
                    datetime.fromisoformat(created_at.replace("+00:00", ""))
                    + timedelta(hours=RNG.randint(2, 72))
                )
                comment_items.append(build_comment_item(
                    args.org_id, task_id, project_id, author, msg, c_created,
                ))
    print(f"  {len(task_items)} tasks, {len(comment_items)} comments")
    print()

    # ---- Step 5: attendance + task updates + activity (with screenshots) + summaries ----
    print(f"Step 5: 2-week history for {len(user_records)} users x {len(dates)} workdays")
    attendance_items: list[dict] = []
    taskupdate_items: list[dict] = []
    activity_items: list[dict] = []
    summary_items: list[dict] = []

    for u in user_records:
        assigned_tasks = user_tasks_map.get(u["user_id"], [])
        title_pool = [t[0] for t in assigned_tasks] or ["Sprint planning", "Code review", "Standup"]
        if assigned_tasks:
            default_task = assigned_tasks[0]
        else:
            first_proj = next(iter(project_info_map.values()))
            default_task = ("Sprint planning", list(project_info_map.keys())[0], first_proj["name"])

        for d in dates:
            if RNG.random() < 0.08:
                continue
            t_title, t_proj_id, t_proj_name = RNG.choice(assigned_tasks) if assigned_tasks else default_task
            attendance_items.append(build_attendance_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], user_email=u["email"],
                system_role=u["system_role"], date=d,
                project_id=t_proj_id, project_name=t_proj_name,
                task_id="sprint-general", task_title=t_title,
            ))
            taskupdate_items.append(build_taskupdate_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], employee_id=u["employee_id"],
                date=d, task_titles=title_pool,
            ))
            act, summ = build_activity_with_screenshots(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], user_email=u["email"], date=d,
                user_screenshot_urls=user_screenshot_urls.get(u["user_id"], []),
            )
            activity_items.append(act)
            summary_items.append(summ)

    print(f"  {len(attendance_items)} attendance, {len(taskupdate_items)} task updates,")
    print(f"  {len(activity_items)} activity, {len(summary_items)} summaries")
    print()

    # ---- Step 6: day-offs ----
    print("Step 6: build day-off requests")
    dayoff_items: list[dict] = []
    members_only = [u for u in user_records if u["system_role"] == "MEMBER"]
    for _ in range(15):
        user = RNG.choice(members_only)
        admin = RNG.choice(admins_pool)
        lead = RNG.choice(seniors_pool) if seniors_pool else RNG.choice(user_records)
        days_offset = RNG.randint(-14, 30)
        start = datetime.strptime(args.end_date, "%Y-%m-%d").date() + timedelta(days=days_offset)
        duration = RNG.choice([1, 1, 2, 3])
        end_d = start + timedelta(days=duration - 1)
        admin_status = RNG.choices(["PENDING", "APPROVED", "REJECTED"], weights=[0.35, 0.5, 0.15])[0]
        team_lead_status = RNG.choices(["PENDING", "APPROVED", "N/A"], weights=[0.2, 0.55, 0.25])[0]
        created_at = iso_at(
            datetime.fromisoformat(args.end_date + "T00:00:00+00:00")
            - timedelta(days=RNG.randint(1, 20))
        )
        dayoff_items.append(build_dayoff_item(
            org_id=args.org_id, request_id=str(uuid.uuid4()),
            user_id=user["user_id"], user_name=user["name"],
            employee_id=user["employee_id"],
            start_date=start.isoformat(), end_date=end_d.isoformat(),
            reason=RNG.choice(DAYOFF_REASONS),
            admin_id=admin["user_id"], admin_name=admin["name"],
            admin_status=admin_status,
            team_lead_id=lead["user_id"], team_lead_name=lead["name"],
            team_lead_status=team_lead_status,
            created_at=created_at,
        ))
    print(f"  {len(dayoff_items)} day-off requests")
    print()

    # ---- Step 7: write everything ----
    print("Step 7: write to DynamoDB")
    def _write(label: str, items: list[dict]) -> int:
        if args.dry_run:
            return len(items)
        with table.batch_writer() as batch:
            for it in items:
                batch.put_item(Item=it)
        print(f"  wrote {len(items)} {label}")
        return len(items)

    total = 0
    total += _write("user-profile", user_items)
    total += _write("project", project_items)
    total += _write("project-member", member_items)
    total += _write("task", task_items)
    total += _write("comment", comment_items)
    total += _write("attendance", attendance_items)
    total += _write("task-update", taskupdate_items)
    total += _write("activity", activity_items)
    total += _write("daily-summary", summary_items)
    total += _write("day-off", dayoff_items)
    print()

    verb = "would write" if args.dry_run else "wrote"
    print(f"=== Summary ===")
    print(f"  Cognito users      : {len(_PEOPLE)}  ({'dry-run' if args.dry_run else 'created'})")
    print(f"  Screenshots in S3  : {sum(len(v) for v in user_screenshot_urls.values())}  ({'dry-run' if args.dry_run else 'uploaded'})")
    print(f"  DynamoDB items     : {total}  ({verb})")
    if not args.dry_run:
        print(f"\nLogin: any user email (e.g. {user_records[0]['email']}) / password: {args.password}")
        print(f"Workspace code: {args.org_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
