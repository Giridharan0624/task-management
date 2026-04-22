"""Centralized DynamoDB key builders for the multi-tenant schema.

Every PK/SK/GSI key in the org-scoped schema is constructed here so no
repository string-formats keys inline. Single place to audit for tenant
leakage and single place to change the schema.

During the Phase 1 cutover we dual-write: each context repository adds the
new org-scoped items using these helpers *in addition to* its existing
legacy items. Once the backfill has run and reads are flipped to the new
format, the legacy inline strings in repositories are removed.

Convention: every multi-tenant key starts with `ORG#{org_id}#`. The only
exceptions are:
  - `USER_EMAIL#{email}` — email is globally unique (enforced by Cognito alias)
  - `SLUG#{slug}` — the workspace-code -> org_id resolver (inherently global)

## Per-request org_id propagation

`extract_auth_context()` stamps the current request's org_id into a
ContextVar. Repository constructors read from this ContextVar when no
explicit `org_id` is passed, so handlers don't need to thread the value
through every call site.

Pre-auth handlers (signup, get_org_by_slug, resolve_employee) that run
before the JWT exists can pass an explicit org_id to the repository
constructor, typically `DEFAULT_ORG_ID`.
"""
import contextvars
from typing import Final


DEFAULT_ORG_ID: Final[str] = "neurostack"


_current_org_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "taskflow_current_org_id", default=DEFAULT_ORG_ID
)


def get_current_org_id() -> str:
    """Return the org_id for the current request. Falls back to
    DEFAULT_ORG_ID when called outside a request context (cold start,
    pre-auth handlers) or before `extract_auth_context` ran."""
    return _current_org_id.get()


def set_current_org_id(org_id: str) -> None:
    """Set the org_id for the current request. Called by
    `extract_auth_context()` on every authenticated invocation."""
    _current_org_id.set(org_id)


# ---------------------------------------------------------------------------
# Organization internal records (org / settings / plan / role / pipeline / invite)
# ---------------------------------------------------------------------------

def org_pk(org_id: str) -> str:
    return f"ORG#{org_id}"


def org_sk() -> str:
    return "ORG"


def settings_sk() -> str:
    return "SETTINGS"


def plan_sk() -> str:
    return "PLAN"


def role_sk(role_id: str) -> str:
    return f"ROLE#{role_id}"


def pipeline_sk(pipeline_id: str) -> str:
    return f"PIPELINE#{pipeline_id}"


def invite_sk(token: str) -> str:
    return f"INVITE#{token}"


def invite_token_lookup_pk(token: str) -> str:
    """Global `PK=INVITE_TOKEN#{token}` lookup record so the public
    accept-invite endpoint can resolve a token -> org_id in O(1)
    without a scan."""
    return f"INVITE_TOKEN#{token}"


def invite_token_lookup_sk() -> str:
    return "META"


# ---------------------------------------------------------------------------
# Slug -> org resolver (global, called pre-login for branding lookup)
# ---------------------------------------------------------------------------

def slug_pk(slug: str) -> str:
    return f"SLUG#{slug}"


def slug_sk() -> str:
    return "ORG"


# ---------------------------------------------------------------------------
# User (org-scoped)
# ---------------------------------------------------------------------------

def user_pk(org_id: str, user_id: str) -> str:
    return f"ORG#{org_id}#USER#{user_id}"


def user_sk() -> str:
    return "PROFILE"


def user_email_gsi1pk(email: str) -> str:
    """Global — Cognito enforces email uniqueness via the email alias."""
    return f"USER_EMAIL#{email}"


def user_email_gsi1sk() -> str:
    return "PROFILE"


def employee_gsi2pk(org_id: str, employee_id: str) -> str:
    return f"ORG#{org_id}#EMPLOYEE#{employee_id}"


def employee_gsi2sk() -> str:
    return "PROFILE"


# ---------------------------------------------------------------------------
# Project (org-scoped)
# ---------------------------------------------------------------------------

def project_pk(org_id: str, project_id: str) -> str:
    return f"ORG#{org_id}#PROJECT#{project_id}"


def project_metadata_sk() -> str:
    return "METADATA"


def project_member_sk(user_id: str) -> str:
    return f"MEMBER#{user_id}"


def user_projects_gsi1pk(org_id: str, user_id: str) -> str:
    """Secondary index for 'which projects is this user a member of?'"""
    return f"ORG#{org_id}#USER#{user_id}"


# ---------------------------------------------------------------------------
# Task (lives under project PK)
# ---------------------------------------------------------------------------

def task_sk(task_id: str) -> str:
    return f"TASK#{task_id}"


def task_lookup_gsi1pk(org_id: str, task_id: str) -> str:
    """Secondary index for 'find a task by ID without knowing its project.'"""
    return f"ORG#{org_id}#TASK#{task_id}"


# ---------------------------------------------------------------------------
# Attendance (org + user scoped)
# ---------------------------------------------------------------------------

def attendance_sk(date: str) -> str:
    return f"ATTENDANCE#{date}"


def attendance_date_gsi1pk(org_id: str, date: str) -> str:
    return f"ORG#{org_id}#ATTENDANCE_DATE#{date}"


# ---------------------------------------------------------------------------
# DayOff (org + user scoped)
# ---------------------------------------------------------------------------

def dayoff_sk(created_at: str, request_id: str) -> str:
    return f"DAYOFF#{created_at}#{request_id}"


def dayoff_admin_gsi1pk(org_id: str, admin_id: str) -> str:
    return f"ORG#{org_id}#DAYOFF_ADMIN#{admin_id}"


def dayoff_lead_gsi2pk(org_id: str, lead_id: str) -> str:
    return f"ORG#{org_id}#DAYOFF_LEAD#{lead_id}"


# ---------------------------------------------------------------------------
# Comment (scoped under task)
# ---------------------------------------------------------------------------

def comment_pk(org_id: str, task_id: str) -> str:
    return f"ORG#{org_id}#TASK#{task_id}"


def comment_sk(created_at: str, comment_id: str) -> str:
    return f"COMMENT#{created_at}#{comment_id}"


# ---------------------------------------------------------------------------
# TaskUpdate (daily standups, org-scoped by date)
# ---------------------------------------------------------------------------

def taskupdate_pk(org_id: str, date: str) -> str:
    return f"ORG#{org_id}#TASKUPDATE#{date}"


def taskupdate_sk(user_id: str, update_id: str) -> str:
    return f"USER#{user_id}#{update_id}"


def taskupdate_user_gsi1pk(org_id: str, user_id: str) -> str:
    return f"ORG#{org_id}#USER#{user_id}"


# ---------------------------------------------------------------------------
# Activity (org + user scoped)
# ---------------------------------------------------------------------------

def activity_sk(date: str) -> str:
    return f"ACTIVITY#{date}"


def activity_summary_sk(date: str) -> str:
    return f"SUMMARY#{date}"


def activity_date_gsi1pk(org_id: str, date: str) -> str:
    return f"ORG#{org_id}#ACTIVITY_DATE#{date}"


# ---------------------------------------------------------------------------
# Audit log (org-scoped, time-ordered)
# ---------------------------------------------------------------------------

def audit_pk(org_id: str) -> str:
    """All audit events for an org share one PK so time-range queries
    remain a single Query call. High-volume tenants can later shard by
    month by switching to `AUDIT#{org}#{YYYY-MM}`; not needed day-one."""
    return f"ORG#{org_id}#AUDIT"


def audit_sk(created_at: str, event_id: str) -> str:
    """Time-ordered SK — lexicographic sort on an ISO-8601 string matches
    chronological order, and `event_id` breaks ties for events recorded
    in the same millisecond."""
    return f"EVENT#{created_at}#{event_id}"
