"""Seed the `neurostack` org on STAGING with 50 American demo users and
two weeks of realistic activity — projects, tasks, comments, attendance,
task-updates, day-offs, activity buckets, daily summaries.

Intended flow:
  python scripts/wipe_neurostack_staging.py --confirm     # clean slate first
  python scripts/seed_neurostack_staging.py --dry-run     # preview counts
  python scripts/seed_neurostack_staging.py --confirm     # populate

All 50 users log in with email + shared password (default: `Demo1234!`).
User #1 is the OWNER; users #2-#5 are ADMIN; the rest are MEMBER.

Safety:
  - Hard-coded to staging table/pool. Prod reach-out requires editing this file.
  - Idempotency is NOT attempted — run after wiping.
  - Deterministic (random.seed(42)) so re-runs produce the same data.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Iterable

import boto3
from botocore.exceptions import ClientError


DEFAULT_REGION = "ap-south-1"
DEFAULT_TABLE = "TaskManagementTable-staging"
DEFAULT_POOL_NAME = "TaskManagementUserPool-staging"
DEFAULT_ORG_ID = "neurostack"
DEFAULT_SLUG = "neurostack"
DEFAULT_ORG_NAME = "NEUROSTACK"
DEFAULT_PASSWORD = "Demo1234!"
DEFAULT_END_DATE = "2026-04-21"
DEFAULT_HISTORY_DAYS = 14


# ---------------------------------------------------------------------------
# Data pools — American names, projects, tasks, apps
# ---------------------------------------------------------------------------

# 50 American users. (first, last, designation, department, dob-month, dob-day)
USERS: list[tuple[str, str, str, str, int, int]] = [
    # #1 OWNER
    ("Emma",      "Thompson",  "Chief Executive Officer",   "Executive",   3,  14),
    # #2-5 ADMINS
    ("Liam",      "Anderson",  "Chief Technology Officer",  "Engineering", 6,  22),
    ("Olivia",    "Parker",    "Head of Product",           "Product",     9,   5),
    ("Noah",      "Mitchell",  "VP of Engineering",         "Engineering", 11, 30),
    ("Ava",       "Bennett",   "Head of Design",            "Design",      2,  18),
    # #6-25 Engineering (20)
    ("Ethan",     "Walker",    "Staff Engineer",            "Engineering", 7,  10),
    ("Mia",       "Carter",    "Staff Engineer",            "Engineering", 4,  27),
    ("Lucas",     "Hughes",    "Senior Software Engineer",  "Engineering", 8,   3),
    ("Isabella",  "Foster",    "Senior Software Engineer",  "Engineering", 1,  15),
    ("Mason",     "Brooks",    "Senior Software Engineer",  "Engineering", 12, 11),
    ("Charlotte", "Reed",      "Senior Software Engineer",  "Engineering", 5,  26),
    ("Logan",     "Murphy",    "Senior Software Engineer",  "Engineering", 10,  8),
    ("Harper",    "Cooper",    "Software Engineer",         "Engineering", 3,  29),
    ("Benjamin",  "Hayes",     "Software Engineer",         "Engineering", 6,   6),
    ("Amelia",    "Torres",    "Software Engineer",         "Engineering", 2,   9),
    ("Jackson",   "Russell",   "Software Engineer",         "Engineering", 9,  17),
    ("Sophia",    "Diaz",      "Software Engineer",         "Engineering", 11,  2),
    ("Aiden",     "Coleman",   "Software Engineer",         "Engineering", 4,  12),
    ("Scarlett",  "Sanders",   "Software Engineer",         "Engineering", 7,  21),
    ("Henry",     "Powell",    "Software Engineer",         "Engineering", 8,  28),
    ("Evelyn",    "Patterson", "Software Engineer",         "Engineering", 5,   4),
    ("Daniel",    "Morgan",    "Software Engineer",         "Engineering", 1,  23),
    ("Luna",      "Rivera",    "Software Engineer",         "Engineering", 10, 19),
    ("Samuel",    "Bryant",    "Junior Software Engineer",  "Engineering", 12,  7),
    ("Lily",      "Wells",     "Junior Software Engineer",  "Engineering", 3,   1),
    # #26-30 Design (5)
    ("Elijah",    "Henderson", "Senior Product Designer",   "Design",      6,  16),
    ("Aria",      "Pierce",    "Senior Product Designer",   "Design",      9,  25),
    ("Sebastian", "Griffin",   "Product Designer",          "Design",      2,  13),
    ("Zoe",       "Simmons",   "Product Designer",          "Design",      7,  31),
    ("Carter",    "Barnes",    "Visual Designer",           "Design",      4,  20),
    # #31-35 Product (5)
    ("Grace",     "Watson",    "Senior Product Manager",    "Product",     11, 24),
    ("Wyatt",     "Shaw",      "Product Manager",           "Product",     5,   8),
    ("Hazel",     "Ellis",     "Product Manager",           "Product",     8,  15),
    ("Owen",      "Newman",    "Associate Product Manager", "Product",     1,  11),
    ("Violet",    "Hart",      "Product Analyst",           "Product",     10, 30),
    # #36-40 QA (5)
    ("Gabriel",   "Ramsey",    "Senior QA Engineer",        "Quality",     3,   7),
    ("Nora",      "Mason",     "QA Engineer",               "Quality",     6,  19),
    ("Julian",    "Porter",    "QA Engineer",               "Quality",     9,   3),
    ("Aurora",    "Hicks",     "QA Automation Engineer",    "Quality",     12, 28),
    ("Levi",      "Spencer",   "QA Engineer",               "Quality",     2,  25),
    # #41-45 HR + Ops (5)
    ("Chloe",     "Hughes",    "Head of People",            "People",      7,   2),
    ("Ryan",      "Blake",     "HR Business Partner",       "People",      4,  14),
    ("Penelope",  "Curtis",    "Talent Acquisition Partner","People",      11, 17),
    ("Theodore",  "Wade",      "IT Operations Lead",        "Operations",  8,  22),
    ("Stella",    "Owens",     "Office Operations Manager", "Operations",  1,   6),
    # #46-50 Marketing (5)
    ("Hudson",    "Barrett",   "Director of Marketing",     "Marketing",   5,  13),
    ("Ellie",     "Knight",    "Content Marketing Manager", "Marketing",   10, 26),
    ("Caleb",     "Dalton",    "Growth Marketing Manager",  "Marketing",   3,  18),
    ("Savannah",  "Weaver",    "Marketing Coordinator",     "Marketing",   6,   4),
    ("Easton",    "Ray",       "SEO Specialist",            "Marketing",   9,  29),
]
assert len(USERS) == 50

EMAIL_DOMAIN = "neurostack.demo"

# Projects and the domains they belong to.
PROJECTS: list[dict] = [
    {
        "name":        "Payments Platform V2",
        "description": "Rewrite of the legacy payments service onto the new event bus. Adds Stripe Connect, multi-currency, and SCA-compliant checkout.",
        "domain":      "DEVELOPMENT",
        "estimated":   4200.0,
    },
    {
        "name":        "Customer Dashboard Redesign",
        "description": "End-to-end redesign of the customer-facing analytics dashboard. Focus: faster time-to-insight, mobile-first, accessible color tokens.",
        "domain":      "DESIGNING",
        "estimated":   1800.0,
    },
    {
        "name":        "Mobile App Launch Q2",
        "description": "Native iOS + Android launch covering core timer, task inbox, and offline sync. Pilot at 500 users; public launch mid-June.",
        "domain":      "DEVELOPMENT",
        "estimated":   3600.0,
    },
    {
        "name":        "SOC 2 Readiness 2026",
        "description": "Controls inventory, evidence collection, tabletop exercises, and auditor scheduling. Target letter of attestation by end of Q3.",
        "domain":      "MANAGEMENT",
        "estimated":   900.0,
    },
    {
        "name":        "AI Recommendations Research",
        "description": "Evaluate foundation-model options (Claude, GPT-4.x, open-weights) for product recommendations. Produce ROI memo + reference pipeline.",
        "domain":      "RESEARCH",
        "estimated":   650.0,
    },
    {
        "name":        "Marketing Website Refresh",
        "description": "Replatform marketing.company.com onto Next.js + Sanity. Revamp product pages, add resource hub, drive SEO lift.",
        "domain":      "DESIGNING",
        "estimated":   1100.0,
    },
]

# Task title templates per domain.
TASK_TITLES: dict[str, list[str]] = {
    "DEVELOPMENT": [
        "Migrate checkout service to new event bus",
        "Add idempotency keys to refund endpoint",
        "Wire Stripe Connect onboarding flow",
        "Implement multi-currency conversion service",
        "Rate-limit webhook ingestion",
        "Add SCA challenge UI for 3DS",
        "Build reconciliation report generator",
        "Harden JWT rotation in auth middleware",
        "Migrate from Redis 6 to Valkey 8",
        "Add retry policy to payout job",
        "Instrument new traces in payments pipeline",
        "Backfill merchant IDs in orders table",
        "Replace bespoke cache with Cloudflare KV",
        "Build admin CSV export for transactions",
        "Tighten request-body size limits at edge",
        "Drop legacy v1 invoice endpoints",
        "Write Postman collection for partner API",
        "Ship feature flag for new fraud model",
        "Migrate image uploads to presigned R2",
        "Fix flaky end-to-end test for refunds",
        "Update SDK to handle partial captures",
        "Add correlation IDs across services",
        "Gracefully degrade when Elasticsearch is down",
        "Cut over dashboards to new metrics pipeline",
        "Implement webhook replay tool",
    ],
    "DESIGNING": [
        "Audit current dashboard for accessibility",
        "Produce wireframes for new landing page",
        "Design empty states for reports view",
        "Refresh color tokens for WCAG AA contrast",
        "Prototype mobile chart interactions",
        "Revise navigation IA with usability testing",
        "Build motion spec for page transitions",
        "Design onboarding checklist widget",
        "Audit marketing site typography stack",
        "Update Figma component library v3",
        "Ship illustration set for empty states",
        "Design SSO setup modal",
        "Revise error-state patterns",
        "Prototype filter chips for task board",
        "Ship light/dark token parity audit",
        "Create case study page template",
        "Redesign pricing matrix",
        "Refresh hero imagery for homepage",
        "Build icon set for new feature areas",
        "Design in-product NPS survey flow",
    ],
    "MANAGEMENT": [
        "Compile controls inventory for SOC 2",
        "Schedule Type I auditor kickoff",
        "Draft acceptable-use policy revision",
        "Run tabletop: customer-data incident",
        "Run tabletop: ransomware scenario",
        "Collect evidence for logical access controls",
        "Review vendor list for SOC 2 scope",
        "Finalize access-review cadence and owners",
        "Publish updated data-retention policy",
        "Document change-management process",
        "Audit production IAM role boundaries",
        "Prepare executive steering update — week 3",
        "Review BYOD policy for mobile engineers",
        "Run phishing simulation and publish results",
        "Close out findings from last penetration test",
    ],
    "RESEARCH": [
        "Benchmark Claude 4.7 vs GPT-4.x on rec task",
        "Build golden-set of 500 rec examples",
        "Compile ROI memo with three pricing scenarios",
        "Prototype retrieval-augmented rec pipeline",
        "Run cost projection for 10M monthly queries",
        "Interview five customers about rec use cases",
        "Draft reference architecture for inference path",
        "Survey open-weights rec papers 2024-2026",
        "Produce latency budget for p95 < 300ms",
        "Write decision memo on build vs buy",
    ],
}

# Task statuses available per domain.
TASK_STATUSES: dict[str, list[str]] = {
    "DEVELOPMENT": ["TODO", "IN_PROGRESS", "DEVELOPED", "CODE_REVIEW", "TESTING", "DEBUGGING", "FINAL_TESTING", "DONE"],
    "DESIGNING":   ["TODO", "IN_PROGRESS", "WIREFRAME", "DESIGN", "REVIEW", "REVISION", "APPROVED", "DONE"],
    "MANAGEMENT":  ["TODO", "PLANNING", "IN_PROGRESS", "EXECUTION", "REVIEW", "DONE"],
    "RESEARCH":    ["TODO", "IN_PROGRESS", "RESEARCH", "ANALYSIS", "DOCUMENTATION", "REVIEW", "DONE"],
}

STATUS_WEIGHTS = [0.25, 0.12, 0.10, 0.10, 0.08, 0.05, 0.05, 0.25]  # last entry = DONE

COMMENT_TEMPLATES = [
    "Pushed first pass for review — happy to pair on the retry policy if anyone has time today.",
    "Scope got bigger than expected; I'm breaking this into two PRs so the payments branch stays reviewable.",
    "Blocked on infra — opened a ticket with SRE, will bump tomorrow if no movement.",
    "Design handoff landed, moving to implementation now.",
    "Rebased onto main and reran the suite — 4 flakes, unrelated to this change.",
    "Talked to Ryan about the policy wording — he's fine with the revision. Will merge after one more read.",
    "Benchmarks are in: 42ms p95 locally, 68ms from staging. Good margin on the 300ms budget.",
    "Found a subtle race in the webhook consumer; fix in a follow-up PR.",
    "Final QA passed. Ready to cut over behind the flag on Monday.",
    "Reviewed and approved — nice cleanup on the validation helpers.",
    "Spec looks solid. One nit: can we document the rollback path in the same doc?",
    "Updated the Figma file with the revised tokens. Eng, pls resync when you can.",
    "Customer interview #3 done — they want filtering before sort. Updating the brief.",
    "Merged and monitoring. No alerts so far. Will watch through tomorrow.",
    "Draft policy up in Notion. Open for comments until Thursday.",
    "Pair-debugged with Charlotte — root cause was a stale cache key. Fix incoming.",
    "This one's ready for final testing, handing off to Aurora.",
    "Pushed the data-retention update. Legal has signed off.",
    "Can we split the approved and done states visually? Users keep confusing them.",
    "Writeup is posted — comments welcome from anyone who reviewed the earlier drafts.",
]

# Apps used in activity buckets — weighted.
APPS = [
    ("VS Code",   0.32),
    ("Chrome",    0.18),
    ("Slack",     0.14),
    ("Figma",     0.10),
    ("Terminal",  0.08),
    ("Notion",    0.06),
    ("Zoom",      0.05),
    ("Jira",      0.04),
    ("GitHub",    0.03),
]

SUMMARY_OPENERS = [
    "Solid day of deep work. Focused primarily on ",
    "Productive session. Heavy time in ",
    "Good throughput today. Time split across ",
    "Focused pairing day. Collaboration heavy on ",
    "Steady progress across tickets. Significant time in ",
]

KEY_ACTIVITY_POOL = [
    "Shipped pull request for payments reconciliation",
    "Reviewed two designs in Figma",
    "Pair-programmed with a teammate on checkout",
    "Drafted technical spec for webhook replay",
    "Attended sprint planning and grooming",
    "Debugged flaky CI tests for the auth service",
    "Wrote documentation for the new API",
    "Ran customer discovery interview",
    "Sync with SRE on infra capacity",
    "Contributed to the roadmap planning doc",
    "Investigated production alert and posted RCA",
    "Updated Jira estimates for the sprint",
    "Prototype build for rec pipeline experiment",
]

# Day-off reasons and leave types.
LEAVE_TYPES = ["casual", "sick", "earned"]
DAYOFF_REASONS = [
    "Family event out of town.",
    "Doctor's appointment I couldn't reschedule.",
    "Visiting parents for the long weekend.",
    "Down with a nasty flu, planning to rest.",
    "Taking a mental health day — will be back refreshed.",
    "Wedding in the family.",
    "Childcare — school is closed.",
    "Heading out for a short vacation.",
    "Taking earned leave to recover after the launch sprint.",
    "Personal errands I can't do on weekends.",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RNG = random.Random(42)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def iso_at(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def workdays(end_date: str, back_days: int) -> list[str]:
    """Return YYYY-MM-DD strings for workdays (Mon-Fri) within the window
    [end - back_days + 1, end], in chronological order."""
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    out = []
    for i in range(back_days - 1, -1, -1):
        d = end - timedelta(days=i)
        if d.weekday() < 5:  # 0=Mon .. 4=Fri
            out.append(d.isoformat())
    return out


def pick_weighted(choices: list[tuple[str, float]]) -> str:
    return RNG.choices([c[0] for c in choices], weights=[c[1] for c in choices], k=1)[0]


def pick_weighted_status(domain: str) -> str:
    statuses = TASK_STATUSES[domain]
    # Use first N-1 weights, last weight is always the DONE weight.
    weights = STATUS_WEIGHTS[:len(statuses) - 1] + [STATUS_WEIGHTS[-1]]
    return RNG.choices(statuses, weights=weights, k=1)[0]


def email_of(first: str, last: str) -> str:
    return f"{first.lower()}.{last.lower()}@{EMAIL_DOMAIN}"


# ---------------------------------------------------------------------------
# Cognito user creation
# ---------------------------------------------------------------------------

def resolve_pool_id(cognito, pool_name: str) -> str | None:
    next_token = None
    while True:
        kwargs = {"MaxResults": 60}
        if next_token:
            kwargs["NextToken"] = next_token
        resp = cognito.list_user_pools(**kwargs)
        for p in resp.get("UserPools", []):
            if p["Name"] == pool_name:
                return p["Id"]
        next_token = resp.get("NextToken")
        if not next_token:
            break
    return None


def create_cognito_user(cognito, pool_id: str, email: str, name: str,
                        system_role: str, org_id: str, employee_id: str,
                        password: str) -> str:
    """Create + confirm a Cognito user. Returns the Cognito sub (user_id)."""
    resp = cognito.admin_create_user(
        UserPoolId=pool_id,
        Username=email,
        UserAttributes=[
            {"Name": "email",              "Value": email},
            {"Name": "email_verified",     "Value": "true"},
            {"Name": "name",               "Value": name},
            {"Name": "custom:orgId",       "Value": org_id},
            {"Name": "custom:systemRole",  "Value": system_role},
            {"Name": "custom:employeeId",  "Value": employee_id},
        ],
        MessageAction="SUPPRESS",
    )
    cognito.admin_set_user_password(
        UserPoolId=pool_id,
        Username=email,
        Password=password,
        Permanent=True,
    )
    for attr in resp["User"]["Attributes"]:
        if attr["Name"] == "sub":
            return attr["Value"]
    raise RuntimeError(f"Cognito returned no sub for {email}")


# ---------------------------------------------------------------------------
# Item builders (DynamoDB dicts matching the repository mappers)
# ---------------------------------------------------------------------------

def build_org_level_items(org_id: str, slug: str, display_name: str,
                          owner_user_id: str, now: str) -> list[dict]:
    organization = {
        "PK": f"ORG#{org_id}", "SK": "ORG",
        "org_id": org_id, "slug": slug, "name": display_name,
        "owner_user_id": owner_user_id, "status": "ACTIVE",
        "plan_tier": "ENTERPRISE",
        "created_at": now, "updated_at": now,
    }
    settings = {
        "PK": f"ORG#{org_id}", "SK": "SETTINGS",
        "org_id": org_id, "display_name": display_name,
        "primary_color": "#4F46E5", "accent_color": "#10B981",
        "terminology": json.dumps({}),
        "timezone": "America/New_York",
        "locale": "en-US",
        "currency": "USD",
        "week_start_day": 0,  # US week starts Sunday
        "working_hours_start": "09:00", "working_hours_end": "18:00",
        "employee_id_prefix": "EMP-",
        "features": json.dumps({
            "birthday_wishes": True, "activity_monitoring": True,
            "screenshots": True, "ai_summaries": True,
            "day_offs": True, "comments": True, "task_updates": True,
        }),
        "leave_types": json.dumps([
            {"id": "casual", "name": "Casual",  "annual_quota": 12},
            {"id": "sick",   "name": "Sick",    "annual_quota": 10},
            {"id": "earned", "name": "Earned",  "annual_quota": 15},
        ]),
        "created_at": now, "updated_at": now,
    }
    plan = {
        "PK": f"ORG#{org_id}", "SK": "PLAN",
        "org_id": org_id, "tier": "ENTERPRISE",
        "max_users": None, "max_projects": None, "retention_days": None,
        "features_allowed": json.dumps(sorted({
            "birthday_wishes", "activity_monitoring", "screenshots",
            "ai_summaries", "day_offs", "comments", "task_updates",
            "custom_pipelines", "custom_roles", "api_access",
            "sso", "audit_logs", "white_label", "custom_domain",
        })),
        "created_at": now, "updated_at": now,
    }
    slug_record = {
        "PK": f"SLUG#{slug}", "SK": "ORG",
        "slug": slug, "org_id": org_id, "created_at": now,
    }
    return [organization, settings, plan, slug_record]


def build_role_items(org_id: str, now: str) -> list[dict]:
    # Import the source-of-truth permission set so the seed stays in sync
    # with the running app.
    _BACKEND_SRC = __file__.replace("scripts/seed_neurostack_staging.py", "src")
    _BACKEND_SRC = _BACKEND_SRC.replace("scripts\\seed_neurostack_staging.py", "src")
    sys.path.insert(0, _BACKEND_SRC)
    from contexts.org.domain.default_roles import (  # type: ignore
        OWNER_PERMISSIONS, ADMIN_PERMISSIONS, MEMBER_PERMISSIONS,
    )

    def rec(role_id: str, name: str, perms: frozenset[str]) -> dict:
        return {
            "PK": f"ORG#{org_id}", "SK": f"ROLE#{role_id}",
            "org_id": org_id, "role_id": role_id, "name": name,
            "scope": "system", "is_system": True,
            "permissions": json.dumps(sorted(perms)),
            "created_at": now, "updated_at": now,
        }
    return [
        rec("owner",  "Owner",  OWNER_PERMISSIONS),
        rec("admin",  "Admin",  ADMIN_PERMISSIONS),
        rec("member", "Member", MEMBER_PERMISSIONS),
    ]


def build_pipeline_items(org_id: str, now: str) -> list[dict]:
    """Mirror backend/src/contexts/org/domain/default_pipelines.py"""
    def statuses(rows):
        return [
            {"id": sid, "label": label, "color": color,
             "order": i, "is_terminal": (i == len(rows) - 1)}
            for i, (sid, label, color) in enumerate(rows)
        ]

    dev = statuses([
        ("TODO", "To Do", "#F59E0B"),
        ("IN_PROGRESS", "In Progress", "#3B82F6"),
        ("DEVELOPED", "Developed", "#8B5CF6"),
        ("CODE_REVIEW", "Code Review", "#A855F7"),
        ("TESTING", "Testing", "#F97316"),
        ("DEBUGGING", "Debugging", "#EF4444"),
        ("FINAL_TESTING", "Final Testing", "#EC4899"),
        ("DONE", "Done", "#10B981"),
    ])
    des = statuses([
        ("TODO", "To Do", "#F59E0B"),
        ("IN_PROGRESS", "In Progress", "#3B82F6"),
        ("WIREFRAME", "Wireframe", "#64748B"),
        ("DESIGN", "Design", "#6366F1"),
        ("REVIEW", "Review", "#06B6D4"),
        ("REVISION", "Revision", "#F43F5E"),
        ("APPROVED", "Approved", "#10B981"),
        ("DONE", "Done", "#10B981"),
    ])
    mgmt = statuses([
        ("TODO", "To Do", "#F59E0B"),
        ("PLANNING", "Planning", "#6366F1"),
        ("IN_PROGRESS", "In Progress", "#3B82F6"),
        ("EXECUTION", "Execution", "#3B82F6"),
        ("REVIEW", "Review", "#06B6D4"),
        ("DONE", "Done", "#10B981"),
    ])
    research = statuses([
        ("TODO", "To Do", "#F59E0B"),
        ("IN_PROGRESS", "In Progress", "#3B82F6"),
        ("RESEARCH", "Research", "#8B5CF6"),
        ("ANALYSIS", "Analysis", "#14B8A6"),
        ("DOCUMENTATION", "Documentation", "#F97316"),
        ("REVIEW", "Review", "#06B6D4"),
        ("DONE", "Done", "#10B981"),
    ])

    def rec(pipeline_id: str, name: str, statuses_list: list[dict], is_default: bool):
        return {
            "PK": f"ORG#{org_id}", "SK": f"PIPELINE#{pipeline_id}",
            "org_id": org_id, "pipeline_id": pipeline_id,
            "name": name, "is_default": is_default,
            "statuses": json.dumps(statuses_list),
            "created_at": now, "updated_at": now,
        }
    return [
        rec("DEVELOPMENT", "Development", dev,  is_default=True),
        rec("DESIGNING",   "Designing",   des,  is_default=False),
        rec("MANAGEMENT",  "Management",  mgmt, is_default=False),
        rec("RESEARCH",    "Research",    research, is_default=False),
    ]


def build_user_item(org_id: str, user_id: str, employee_id: str, email: str,
                    name: str, system_role: str, designation: str,
                    department: str, dob_month: int, dob_day: int,
                    created_by: str | None, now: str) -> dict:
    dob = f"1992-{dob_month:02d}-{dob_day:02d}"  # synthetic year for all
    item = {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": "PROFILE",
        "GSI1PK": f"USER_EMAIL#{email}",
        "GSI1SK": "PROFILE",
        "GSI2PK": f"ORG#{org_id}#EMPLOYEE#{employee_id}",
        "GSI2SK": "PROFILE",
        "org_id": org_id,
        "user_id": user_id,
        "employee_id": employee_id,
        "email": email,
        "name": name,
        "system_role": system_role,
        "designation": designation,
        "department": department,
        "location": "United States",
        "date_of_birth": dob,
        "created_at": now,
        "updated_at": now,
    }
    if created_by:
        item["created_by"] = created_by
    return item


def build_project_item(org_id: str, project_id: str, project: dict,
                       created_by: str, now: str) -> dict:
    return {
        "PK": f"ORG#{org_id}#PROJECT#{project_id}",
        "SK": "METADATA",
        "org_id": org_id,
        "project_id": project_id,
        "name": project["name"],
        "description": project["description"],
        "domain": project["domain"],
        "estimated_hours": str(project["estimated"]),
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }


def build_member_item(org_id: str, project_id: str, user_id: str,
                      project_role: str, added_by: str, joined_at: str) -> dict:
    return {
        "PK": f"ORG#{org_id}#PROJECT#{project_id}",
        "SK": f"MEMBER#{user_id}",
        "GSI1PK": f"ORG#{org_id}#USER#{user_id}",
        "GSI1SK": f"PROJECT#{project_id}",
        "org_id": org_id,
        "project_id": project_id,
        "user_id": user_id,
        "project_role": project_role,
        "added_by": added_by,
        "joined_at": joined_at,
    }


def build_task_item(org_id: str, task_id: str, project_id: str, title: str,
                    description: str, status: str, priority: str, domain: str,
                    assigned_to: list[str], assigned_by: str, created_by: str,
                    deadline: str, estimated_hours: float,
                    created_at: str, updated_at: str) -> dict:
    return {
        "PK": f"ORG#{org_id}#PROJECT#{project_id}",
        "SK": f"TASK#{task_id}",
        "GSI1PK": f"ORG#{org_id}#TASK#{task_id}",
        "GSI1SK": f"PROJECT#{project_id}",
        "org_id": org_id,
        "task_id": task_id,
        "project_id": project_id,
        "title": title,
        "description": description,
        "status": status,
        "priority": priority,
        "domain": domain,
        "assigned_to": assigned_to,
        "assigned_by": assigned_by,
        "created_by": created_by,
        "deadline": deadline,
        "estimated_hours": str(estimated_hours),
        "created_at": created_at,
        "updated_at": updated_at,
    }


def build_comment_item(org_id: str, task_id: str, project_id: str,
                       author_id: str, message: str, created_at: str) -> dict:
    comment_id = str(uuid.uuid4())
    return {
        "PK": f"ORG#{org_id}#TASK#{task_id}",
        "SK": f"COMMENT#{created_at}#{comment_id}",
        "org_id": org_id,
        "comment_id": comment_id,
        "task_id": task_id,
        "project_id": project_id,
        "author_id": author_id,
        "message": message,
        "created_at": created_at,
    }


def build_attendance_item(org_id: str, user_id: str, user_name: str,
                          user_email: str, system_role: str, date: str,
                          project_id: str, project_name: str,
                          task_id: str, task_title: str) -> dict:
    """Build one day's attendance for a user — 1 or 2 sessions totalling ~8h."""
    # Sign-in between 08:45 and 09:30, two-session day about 35% of the time.
    sign_in_hour = 9
    sign_in_min = RNG.randint(-15, 30)  # -15 to +30 relative to 9:00
    base = datetime.fromisoformat(f"{date}T00:00:00+00:00")
    sign_in_1 = base.replace(hour=sign_in_hour) + timedelta(minutes=sign_in_min)

    two_sessions = RNG.random() < 0.35
    sessions: list[dict] = []

    if two_sessions:
        # Morning session ~3.5h
        morning_end = sign_in_1 + timedelta(minutes=RNG.randint(180, 240))
        sessions.append({
            "sign_in_at": iso_at(sign_in_1),
            "sign_out_at": iso_at(morning_end),
            "hours": str(round((morning_end - sign_in_1).total_seconds() / 3600, 2)),
            "task_id": task_id, "project_id": project_id,
            "task_title": task_title, "project_name": project_name,
            "description": RNG.choice([
                "Morning deep work block.",
                "Pairing session.",
                "Heads-down on the PR.",
                "Pre-standup focus time.",
            ]),
            "last_heartbeat_at": iso_at(morning_end - timedelta(minutes=2)),
        })
        afternoon_start = morning_end + timedelta(minutes=RNG.randint(45, 75))
        afternoon_end = afternoon_start + timedelta(minutes=RNG.randint(240, 300))
        sessions.append({
            "sign_in_at": iso_at(afternoon_start),
            "sign_out_at": iso_at(afternoon_end),
            "hours": str(round((afternoon_end - afternoon_start).total_seconds() / 3600, 2)),
            "task_id": task_id, "project_id": project_id,
            "task_title": task_title, "project_name": project_name,
            "description": RNG.choice([
                "Afternoon focus.",
                "Reviews + follow-ups.",
                "Fixing review comments.",
                "Working through the backlog.",
            ]),
            "last_heartbeat_at": iso_at(afternoon_end - timedelta(minutes=2)),
        })
    else:
        end = sign_in_1 + timedelta(hours=8, minutes=RNG.randint(-30, 45))
        sessions.append({
            "sign_in_at": iso_at(sign_in_1),
            "sign_out_at": iso_at(end),
            "hours": str(round((end - sign_in_1).total_seconds() / 3600, 2)),
            "task_id": task_id, "project_id": project_id,
            "task_title": task_title, "project_name": project_name,
            "description": RNG.choice([
                "Full day on the project.",
                "Heads-down sprint work.",
                "Deep work day.",
                "Working through sprint priorities.",
            ]),
            "last_heartbeat_at": iso_at(end - timedelta(minutes=2)),
        })

    total_hours = sum(float(s["hours"]) for s in sessions)

    return {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"ATTENDANCE#{date}",
        "GSI1PK": f"ORG#{org_id}#ATTENDANCE_DATE#{date}",
        "GSI1SK": f"USER#{user_id}",
        "org_id": org_id,
        "user_id": user_id,
        "date": date,
        "sessions": json.dumps(sessions),
        "total_hours": str(round(total_hours, 2)),
        "user_name": user_name,
        "user_email": user_email,
        "system_role": system_role,
    }


def build_taskupdate_item(org_id: str, user_id: str, user_name: str,
                          employee_id: str, date: str, task_titles: list[str]) -> dict:
    update_id = str(uuid.uuid4())
    # Distribute ~8h (480 min) across 2-4 tasks with jitter.
    count = RNG.randint(2, min(4, max(2, len(task_titles))))
    pool = task_titles if task_titles else ["Sprint planning"]
    chosen = RNG.sample(pool, k=min(count, len(pool)))
    if len(chosen) < count:
        chosen = chosen + [pool[0]] * (count - len(chosen))
    total_mins = 480
    base = total_mins // len(chosen)
    summary = []
    allocated = 0
    for i, t in enumerate(chosen):
        if i == len(chosen) - 1:
            mins = total_mins - allocated
        else:
            jitter = RNG.randint(-30, 30)
            mins = max(45, base + jitter)
        allocated += mins
        h, m = divmod(mins, 60)
        time_str = f"{h}h {m}m" if h and m else (f"{h}h" if h else f"{m}m")
        summary.append({"task_name": t, "time_recorded": time_str})

    sign_in = RNG.choice(["08:45 AM", "09:00 AM", "09:15 AM", "09:30 AM"])
    sign_out = RNG.choice(["05:45 PM", "06:00 PM", "06:15 PM", "06:30 PM"])
    h, m = divmod(total_mins, 60)
    total_time = f"{h}h {m}m" if m else f"{h}h"
    return {
        "PK": f"ORG#{org_id}#TASKUPDATE#{date}",
        "SK": f"USER#{user_id}#{update_id}",
        "GSI1PK": f"ORG#{org_id}#USER#{user_id}",
        "GSI1SK": f"TASKUPDATE#{date}",
        "org_id": org_id,
        "update_id": update_id,
        "user_id": user_id,
        "user_name": user_name,
        "employee_id": employee_id,
        "date": date,
        "sign_in": sign_in,
        "sign_out": sign_out,
        "task_summary": json.dumps(summary),
        "total_time": total_time,
        "created_at": f"{date}T18:30:00+00:00",
    }


def build_activity_item(org_id: str, user_id: str, user_name: str,
                        user_email: str, date: str) -> tuple[dict, dict]:
    """Return (activity_item, summary_item) for one user-day."""
    # ~8h of work, bucketed every 5 minutes.
    bucket_count = 96  # 8h / 5min
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
        # Distribute 300s across 1-3 apps
        app_breakdown: dict[str, int] = {top_app: RNG.randint(120, active_s)}
        remaining = active_s - app_breakdown[top_app]
        if remaining > 0:
            second = pick_weighted(APPS)
            if second == top_app:
                second = RNG.choice([a[0] for a in APPS if a[0] != top_app])
            app_breakdown[second] = remaining
        for a, s in app_breakdown.items():
            app_usage[a] = app_usage.get(a, 0) + s
        buckets.append({
            "timestamp": iso_at(ts),
            "keyboard_count": RNG.randint(40, 480),
            "mouse_count": RNG.randint(30, 220),
            "active_seconds": active_s,
            "idle_seconds": idle_s,
            "top_app": top_app,
            "app_breakdown": app_breakdown,
            "screenshot_url": None,
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

    # Summary
    top_apps = sorted(app_usage.items(), key=lambda kv: kv[1], reverse=True)[:3]
    opener = RNG.choice(SUMMARY_OPENERS)
    summary_text = opener + ", ".join(a for a, _ in top_apps) + (
        f". Active {round(total_active / 60)}m vs idle {round(total_idle / 60)}m — a healthy focus ratio."
    )
    key_acts = RNG.sample(KEY_ACTIVITY_POOL, k=RNG.randint(3, 5))
    summary_item = {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"SUMMARY#{date}",
        "org_id": org_id,
        "user_id": user_id,
        "date": date,
        "summary": summary_text,
        "key_activities": json.dumps(key_acts),
        "productivity_score": RNG.randint(6, 9),
        "concerns": json.dumps([]),
        "total_active_minutes": str(round(total_active / 60, 1)),
        "total_idle_minutes": str(round(total_idle / 60, 1)),
        "app_usage": json.dumps(app_usage),
        "generated_at": f"{date}T19:00:00+00:00",
        "user_name": user_name,
    }
    return activity_item, summary_item


def build_dayoff_item(org_id: str, request_id: str, user_id: str, user_name: str,
                      employee_id: str, start_date: str, end_date: str,
                      reason: str, admin_id: str, admin_name: str,
                      admin_status: str, team_lead_id: str | None,
                      team_lead_name: str | None, team_lead_status: str,
                      created_at: str) -> dict:
    # Overall status derived from admin_status (simplified for demo).
    status = admin_status
    item: dict = {
        "PK": f"ORG#{org_id}#USER#{user_id}",
        "SK": f"DAYOFF#{created_at}#{request_id}",
        "GSI1PK": f"ORG#{org_id}#DAYOFF_ADMIN#{admin_id}",
        "GSI1SK": f"DAYOFF#{created_at}#{request_id}",
        "org_id": org_id,
        "request_id": request_id,
        "user_id": user_id,
        "user_name": user_name,
        "employee_id": employee_id,
        "start_date": start_date,
        "end_date": end_date,
        "reason": reason,
        "status": status,
        "team_lead_status": team_lead_status,
        "admin_id": admin_id,
        "admin_name": admin_name,
        "admin_status": admin_status,
        "created_at": created_at,
        "updated_at": created_at,
    }
    if team_lead_id:
        item["team_lead_id"] = team_lead_id
        item["GSI2PK"] = f"ORG#{org_id}#DAYOFF_LEAD#{team_lead_id}"
        item["GSI2SK"] = f"DAYOFF#{created_at}#{request_id}"
    if team_lead_name:
        item["team_lead_name"] = team_lead_name
    return item


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def write_items(table, items: list[dict], dry_run: bool, label: str) -> int:
    if dry_run:
        return len(items)
    count = 0
    with table.batch_writer() as batch:
        for it in items:
            batch.put_item(Item=it)
            count += 1
    print(f"  wrote {count} {label} items")
    return count


def run_seed(args) -> int:
    session = boto3.Session(region_name=args.region)
    ddb = session.resource("dynamodb")
    table = ddb.Table(args.table)
    cognito = session.client("cognito-idp")

    print(f"=== seed_neurostack_staging ({'DRY-RUN' if args.dry_run else 'LIVE'}) ===")
    print(f"  Region     : {args.region}")
    print(f"  Table      : {args.table}")
    print(f"  Pool       : {args.pool_name}")
    print(f"  Org        : {args.org_id}")
    print(f"  Slug       : {args.slug}")
    print(f"  Password   : {args.password}   (shared across all seeded users)")
    print(f"  End date   : {args.end_date}   Workdays history = {args.history_days}")
    print()

    print("Resolving Cognito pool id ...")
    pool_id = resolve_pool_id(cognito, args.pool_name)
    if pool_id is None:
        print(f"  ERROR: pool {args.pool_name!r} not found in {args.region}", file=sys.stderr)
        return 2
    print(f"  pool id: {pool_id}")
    print()

    now = iso_now()
    dates = workdays(args.end_date, args.history_days)
    print(f"Workdays to populate: {len(dates)} days ({dates[0]} -> {dates[-1]})")
    print()

    # ------- Step 1: Cognito users + user profiles -------
    print(f"Step 1: create {len(USERS)} Cognito users + user profiles")
    user_records: list[dict] = []   # [{user_id, employee_id, email, name, system_role, dept, desig, dob_m, dob_d}]
    all_user_items: list[dict] = []
    owner_sub = ""

    for idx, (first, last, desig, dept, dob_m, dob_d) in enumerate(USERS, start=1):
        email = email_of(first, last)
        name = f"{first} {last}"
        employee_id = f"EMP-{idx:03d}"
        if idx == 1:
            system_role = "OWNER"
        elif idx <= 5:
            system_role = "ADMIN"
        else:
            system_role = "MEMBER"

        if args.dry_run:
            user_id = f"dry-sub-{idx:03d}-{uuid.uuid4().hex[:8]}"
        else:
            try:
                user_id = create_cognito_user(
                    cognito, pool_id, email, name, system_role,
                    args.org_id, employee_id, args.password,
                )
            except ClientError as e:
                print(f"  FAILED {email}: {e.response['Error'].get('Message', e)}", file=sys.stderr)
                return 3

        if idx == 1:
            owner_sub = user_id

        user_records.append({
            "user_id": user_id, "employee_id": employee_id, "email": email,
            "name": name, "system_role": system_role, "department": dept,
            "designation": desig, "dob_m": dob_m, "dob_d": dob_d,
        })

        all_user_items.append(build_user_item(
            org_id=args.org_id, user_id=user_id, employee_id=employee_id,
            email=email, name=name, system_role=system_role,
            designation=desig, department=dept,
            dob_month=dob_m, dob_day=dob_d,
            created_by=(owner_sub if idx > 1 else None), now=now,
        ))
        if not args.dry_run and idx % 10 == 0:
            print(f"  ... {idx} Cognito users created")

    print(f"  {len(USERS)} Cognito users {'would be created' if args.dry_run else 'created'}")
    print()

    # ------- Step 2: org-level records -------
    print("Step 2: build org-level records (org, settings, plan, slug, 3 roles, 4 pipelines)")
    org_items = build_org_level_items(args.org_id, args.slug, args.display_name, owner_sub, now)
    role_items = build_role_items(args.org_id, now)
    pipeline_items = build_pipeline_items(args.org_id, now)
    print(f"  {len(org_items)} org items, {len(role_items)} roles, {len(pipeline_items)} pipelines")
    print()

    # ------- Step 3: projects + members -------
    print(f"Step 3: build {len(PROJECTS)} projects + members")
    project_items: list[dict] = []
    member_items: list[dict] = []
    # project_id → list of user_ids for later use
    project_members_map: dict[str, list[str]] = {}
    project_info_map: dict[str, dict] = {}

    for p_idx, project in enumerate(PROJECTS, start=1):
        project_id = f"proj-{p_idx:02d}-{uuid.uuid4().hex[:8]}"
        project_info_map[project_id] = {**project, "project_id": project_id}
        # Creator: cycle through first 5 admins/owner
        creator = user_records[p_idx % 5]
        project_items.append(build_project_item(
            args.org_id, project_id, project, creator["user_id"], now))

        # Members: 10-15 random users from relevant departments + some randoms.
        pool = [u for u in user_records]
        count = RNG.randint(10, 15)
        members = RNG.sample(pool, k=count)
        project_members_map[project_id] = [m["user_id"] for m in members]

        # One of the admins is PROJECT_MANAGER, one senior is TEAM_LEAD, rest MEMBER.
        pm = RNG.choice([u for u in user_records[:5]])
        tl = RNG.choice([u for u in user_records[5:25]])
        roles_taken = {pm["user_id"], tl["user_id"]}
        member_items.append(build_member_item(
            args.org_id, project_id, pm["user_id"], "PROJECT_MANAGER",
            creator["user_id"], now,
        ))
        member_items.append(build_member_item(
            args.org_id, project_id, tl["user_id"], "TEAM_LEAD",
            creator["user_id"], now,
        ))
        # Ensure PM and TL are in the members list too
        if pm["user_id"] not in project_members_map[project_id]:
            project_members_map[project_id].append(pm["user_id"])
        if tl["user_id"] not in project_members_map[project_id]:
            project_members_map[project_id].append(tl["user_id"])
        for m in members:
            if m["user_id"] in roles_taken:
                continue
            member_items.append(build_member_item(
                args.org_id, project_id, m["user_id"], "MEMBER",
                creator["user_id"], now,
            ))
    print(f"  {len(project_items)} projects, {len(member_items)} memberships")
    print()

    # ------- Step 4: tasks + comments -------
    print("Step 4: build tasks + comments")
    task_items: list[dict] = []
    comment_items: list[dict] = []
    # user_id → list of (task_title, project_id, project_name) they're assigned to
    user_tasks_map: dict[str, list[tuple[str, str, str]]] = {u["user_id"]: [] for u in user_records}

    for project_id, project in project_info_map.items():
        domain = project["domain"]
        titles = TASK_TITLES[domain]
        count = RNG.randint(35, 45)
        members = project_members_map[project_id]
        creator = RNG.choice([u for u in user_records[:5]])["user_id"]
        for _ in range(count):
            task_id = f"task-{uuid.uuid4().hex[:12]}"
            title = RNG.choice(titles)
            desc = (
                f"{title}. Scope covers the initial implementation, tests, and rollout plan. "
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
                domain=domain, assigned_to=assigned, assigned_by=creator,
                created_by=creator, deadline=deadline_day.isoformat(),
                estimated_hours=est_hours, created_at=created_at, updated_at=created_at,
            ))
            for a in assigned:
                user_tasks_map[a].append((title, project_id, project["name"]))

            # 1-3 comments per task from assignees + creator
            for _ in range(RNG.randint(1, 3)):
                author = RNG.choice(assigned + [creator])
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

    # ------- Step 5: attendance + task updates + activity + summaries -------
    print(f"Step 5: build 2-week history for all {len(user_records)} users x {len(dates)} workdays")
    attendance_items: list[dict] = []
    taskupdate_items: list[dict] = []
    activity_items: list[dict] = []
    summary_items: list[dict] = []

    for u in user_records:
        # Pool of task titles this user is assigned to (with project context).
        assigned_tasks = user_tasks_map.get(u["user_id"], [])
        title_pool = [t[0] for t in assigned_tasks] or ["Sprint planning", "Code review", "Standup"]
        if assigned_tasks:
            default_task = assigned_tasks[0]
        else:
            # Fall back: pick the first project's first task context
            first_proj = next(iter(project_info_map.values()))
            default_task = ("Sprint planning", list(project_info_map.keys())[0], first_proj["name"])

        for d in dates:
            # 8% chance the user was out sick / on leave this day — skip attendance.
            if RNG.random() < 0.08:
                continue
            t_title, t_proj_id, t_proj_name = RNG.choice(assigned_tasks) if assigned_tasks else default_task
            # Pick an actual task_id from that project
            # (optional detail — sessions store task_id as a free string).
            t_task_id = "sprint-general"
            attendance_items.append(build_attendance_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], user_email=u["email"],
                system_role=u["system_role"], date=d,
                project_id=t_proj_id, project_name=t_proj_name,
                task_id=t_task_id, task_title=t_title,
            ))
            taskupdate_items.append(build_taskupdate_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], employee_id=u["employee_id"],
                date=d, task_titles=title_pool,
            ))
            act, summ = build_activity_item(
                org_id=args.org_id, user_id=u["user_id"],
                user_name=u["name"], user_email=u["email"], date=d,
            )
            activity_items.append(act)
            summary_items.append(summ)

    print(f"  {len(attendance_items)} attendance, {len(taskupdate_items)} task updates,")
    print(f"  {len(activity_items)} activity records, {len(summary_items)} daily summaries")
    print()

    # ------- Step 6: day-offs -------
    print("Step 6: build day-off requests")
    dayoff_items: list[dict] = []
    # Admins for approval routing
    admins = [u for u in user_records if u["system_role"] in ("OWNER", "ADMIN")]

    for _ in range(25):
        user = RNG.choice([u for u in user_records if u["system_role"] == "MEMBER"])
        admin = RNG.choice(admins)
        lead = RNG.choice([u for u in user_records[5:25] if u["user_id"] != user["user_id"]])

        days_offset = RNG.randint(-14, 30)
        start = datetime.strptime(args.end_date, "%Y-%m-%d").date() + timedelta(days=days_offset)
        duration = RNG.choice([1, 1, 1, 2, 3])
        end_d = start + timedelta(days=duration - 1)

        admin_status = RNG.choices(
            ["PENDING", "APPROVED", "REJECTED"],
            weights=[0.35, 0.5, 0.15],
        )[0]
        team_lead_status = RNG.choices(
            ["PENDING", "APPROVED", "N/A"],
            weights=[0.2, 0.55, 0.25],
        )[0]
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

    # ------- Step 7: write everything -------
    print("Step 7: write to DynamoDB")
    total = 0
    total += write_items(table, org_items, args.dry_run, "org-level")
    total += write_items(table, role_items, args.dry_run, "role")
    total += write_items(table, pipeline_items, args.dry_run, "pipeline")
    total += write_items(table, all_user_items, args.dry_run, "user-profile")
    total += write_items(table, project_items, args.dry_run, "project")
    total += write_items(table, member_items, args.dry_run, "project-member")
    total += write_items(table, task_items, args.dry_run, "task")
    total += write_items(table, comment_items, args.dry_run, "comment")
    total += write_items(table, attendance_items, args.dry_run, "attendance")
    total += write_items(table, taskupdate_items, args.dry_run, "task-update")
    total += write_items(table, activity_items, args.dry_run, "activity")
    total += write_items(table, summary_items, args.dry_run, "daily-summary")
    total += write_items(table, dayoff_items, args.dry_run, "day-off")
    print()

    verb = "would write" if args.dry_run else "wrote"
    print(f"=== Summary ===")
    print(f"  Cognito users      : {len(USERS)}  ({'dry-run' if args.dry_run else 'created'})")
    print(f"  DynamoDB items     : {total}  ({verb})")
    print()

    if args.dry_run:
        print("Dry run complete. Re-run with --confirm to execute.")
    else:
        print("Seed complete.")
        print(f"Login with any user email (e.g. {user_records[0]['email']}) / password: {args.password}")
        print(f"Workspace code: {args.slug}")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed neurostack demo data on staging.")
    parser.add_argument("--table", default=DEFAULT_TABLE)
    parser.add_argument("--pool-name", default=DEFAULT_POOL_NAME)
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--org-id", default=DEFAULT_ORG_ID)
    parser.add_argument("--slug", default=DEFAULT_SLUG)
    parser.add_argument("--display-name", default=DEFAULT_ORG_NAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD,
                        help="shared permanent password for all seeded users")
    parser.add_argument("--end-date", default=DEFAULT_END_DATE,
                        help="YYYY-MM-DD — last day of the history window (default: today)")
    parser.add_argument("--history-days", type=int, default=DEFAULT_HISTORY_DAYS,
                        help="calendar days back from end-date to cover (workdays only kept)")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--confirm", action="store_true",
                        help="REQUIRED to actually write; disables --dry-run")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.confirm:
        args.dry_run = False
    return run_seed(args)


if __name__ == "__main__":
    sys.exit(main())
