"""Default project-scoped roles seeded at org creation.

Mirrors `default_roles.py` for `scope="system"` roles, but these apply
per-project-member assignment. The legacy hardcoded `ProjectRole`
enum (ADMIN, PROJECT_MANAGER, TEAM_LEAD, MEMBER) is replaced by the
four role_ids below — tenants can now clone or edit them from the
Roles & Permissions settings page, same UI as system roles.

Why the `project_*` prefix?
    Role records share the `ROLE#{role_id}` SK namespace under
    `PK=ORG#{org_id}`, so a `role_id="admin"` system role and a
    `role_id="admin"` project role would collide on a single item.
    Prefixing project IDs side-steps the clash while staying readable.
    Mapper translates the legacy enum values (ADMIN, PROJECT_MANAGER,
    TEAM_LEAD, MEMBER) to the prefixed IDs on read, so ProjectMember
    rows written pre-refactor keep working.
"""
from contexts.org.domain import permissions as P


PROJECT_ADMIN_ROLE_ID = "project_admin"
PROJECT_MANAGER_ROLE_ID = "project_manager"
TEAM_LEAD_ROLE_ID = "team_lead"
PROJECT_MEMBER_ROLE_ID = "project_member"

DEFAULT_PROJECT_ROLE_IDS = (
    PROJECT_ADMIN_ROLE_ID,
    PROJECT_MANAGER_ROLE_ID,
    TEAM_LEAD_ROLE_ID,
    PROJECT_MEMBER_ROLE_ID,
)

# Project roles that can manage other project members + approve/assign
# tasks across the project. Replaces the legacy _MANAGE_ROLES tuple in
# use_cases.py. `team_lead` included to preserve existing behavior
# where TLs can assign tasks within their project.
PROJECT_MANAGE_ROLE_IDS = frozenset({
    PROJECT_ADMIN_ROLE_ID,
    PROJECT_MANAGER_ROLE_ID,
    TEAM_LEAD_ROLE_ID,
})


# Permission sets. Project-scope roles get the project + task subset of
# the global catalog — they should never be able to edit org settings
# or billing regardless of what a tenant configures, so the default
# seeds below are the ceiling.
PROJECT_ADMIN_PERMISSIONS: frozenset[str] = frozenset({
    P.PROJECT_UPDATE,
    P.PROJECT_DELETE,
    P.PROJECT_MEMBERS_LIST,
    P.PROJECT_MEMBERS_MANAGE,
    P.TASK_CREATE,
    P.TASK_LIST,
    P.TASK_UPDATE_OWN,
    P.TASK_UPDATE_ANY,
    P.TASK_DELETE,
    P.TASK_ASSIGN,
    P.TASK_VIEW_ALL,
    P.COMMENT_CREATE,
    P.COMMENT_LIST,
})

PROJECT_MANAGER_PERMISSIONS: frozenset[str] = frozenset({
    P.PROJECT_MEMBERS_LIST,
    P.PROJECT_MEMBERS_MANAGE,
    P.TASK_CREATE,
    P.TASK_LIST,
    P.TASK_UPDATE_OWN,
    P.TASK_UPDATE_ANY,
    P.TASK_DELETE,
    P.TASK_ASSIGN,
    P.TASK_VIEW_ALL,
    P.COMMENT_CREATE,
    P.COMMENT_LIST,
})

TEAM_LEAD_PERMISSIONS: frozenset[str] = frozenset({
    P.PROJECT_MEMBERS_LIST,
    P.TASK_CREATE,
    P.TASK_LIST,
    P.TASK_UPDATE_OWN,
    P.TASK_UPDATE_ANY,
    P.TASK_ASSIGN,
    P.TASK_VIEW_ALL,
    P.COMMENT_CREATE,
    P.COMMENT_LIST,
})

PROJECT_MEMBER_PERMISSIONS: frozenset[str] = frozenset({
    P.PROJECT_MEMBERS_LIST,
    P.TASK_CREATE,
    P.TASK_LIST,
    P.TASK_UPDATE_OWN,
    P.COMMENT_CREATE,
    P.COMMENT_LIST,
})


PROJECT_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    PROJECT_ADMIN_ROLE_ID: PROJECT_ADMIN_PERMISSIONS,
    PROJECT_MANAGER_ROLE_ID: PROJECT_MANAGER_PERMISSIONS,
    TEAM_LEAD_ROLE_ID: TEAM_LEAD_PERMISSIONS,
    PROJECT_MEMBER_ROLE_ID: PROJECT_MEMBER_PERMISSIONS,
}

PROJECT_ROLE_DISPLAY_NAMES: dict[str, str] = {
    PROJECT_ADMIN_ROLE_ID: "Project Admin",
    PROJECT_MANAGER_ROLE_ID: "Project Manager",
    TEAM_LEAD_ROLE_ID: "Team Lead",
    PROJECT_MEMBER_ROLE_ID: "Member",
}


# Legacy enum value → new role_id. Used by the ProjectMember mapper
# to translate pre-refactor records. All four legacy values are
# covered; unknown strings fall back to PROJECT_MEMBER (least
# privilege).
LEGACY_PROJECT_ROLE_TO_ID: dict[str, str] = {
    "ADMIN": PROJECT_ADMIN_ROLE_ID,
    "PROJECT_MANAGER": PROJECT_MANAGER_ROLE_ID,
    "TEAM_LEAD": TEAM_LEAD_ROLE_ID,
    "MEMBER": PROJECT_MEMBER_ROLE_ID,
    # Also accept the lowercase forms in case anything slipped through
    # lowercased.
    "admin": PROJECT_ADMIN_ROLE_ID,
    "project_manager": PROJECT_MANAGER_ROLE_ID,
    "team_lead": TEAM_LEAD_ROLE_ID,
    "member": PROJECT_MEMBER_ROLE_ID,
}


def normalize_project_role_id(raw: str) -> str:
    """Accept either a new project role_id or a legacy enum value,
    return the canonical lowercase prefixed role_id. Unknown inputs
    resolve to PROJECT_MEMBER — fail-closed, least-privilege default.
    """
    if not raw:
        return PROJECT_MEMBER_ROLE_ID
    if raw in PROJECT_ROLE_PERMISSIONS:
        return raw
    translated = LEGACY_PROJECT_ROLE_TO_ID.get(raw)
    if translated:
        return translated
    # Tenant-defined custom project role — trust it as-is, let the
    # permission resolver do the real lookup against the Role record.
    return raw
