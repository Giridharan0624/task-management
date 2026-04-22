"""Phase 4 — default system roles seeded at org creation.

OWNER, ADMIN, MEMBER are non-deletable system roles. Their lowercase
`role_id` values map to the uppercase legacy `SystemRole` enum used by
existing user records and JWT claims.
"""
from contexts.org.domain import permissions as P

OWNER_ROLE_ID = "owner"
ADMIN_ROLE_ID = "admin"
MEMBER_ROLE_ID = "member"

DEFAULT_ROLE_IDS = (OWNER_ROLE_ID, ADMIN_ROLE_ID, MEMBER_ROLE_ID)


# OWNER — full access including settings, billing, role management
OWNER_PERMISSIONS: frozenset[str] = P.ALL_PERMISSIONS

# ADMIN — same as OWNER except cannot edit org settings, billing, or roles
ADMIN_PERMISSIONS: frozenset[str] = frozenset(
    P.ALL_PERMISSIONS
    - {P.SETTINGS_EDIT, P.BILLING_VIEW, P.ROLE_MANAGE, P.USER_ROLE_MANAGE}
)

# MEMBER — view + own-update subset. Members can comment on tasks they
# are assigned to, and read comments on tasks in projects they belong
# to. The "see anything" bypass lives behind TASK_VIEW_ALL, which is
# OWNER/ADMIN-only by default.
MEMBER_PERMISSIONS: frozenset[str] = frozenset({
    P.SETTINGS_VIEW,
    P.USER_UPDATE_OWN,
    P.TASK_LIST,
    P.TASK_CREATE,
    P.TASK_UPDATE_OWN,
    P.PROJECT_MEMBERS_LIST,
    P.COMMENT_CREATE,
    P.COMMENT_LIST,
    P.DAYOFF_REQUEST,
})


# Permission lookup keyed by role_id (lowercase) and by SystemRole enum
# value (uppercase) so callers from either side resolve consistently.
SYSTEM_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    OWNER_ROLE_ID: OWNER_PERMISSIONS,
    ADMIN_ROLE_ID: ADMIN_PERMISSIONS,
    MEMBER_ROLE_ID: MEMBER_PERMISSIONS,
    "OWNER": OWNER_PERMISSIONS,
    "ADMIN": ADMIN_PERMISSIONS,
    "MEMBER": MEMBER_PERMISSIONS,
}


def permissions_for_role_id(role_id: str) -> frozenset[str]:
    """Map a role_id (lowercase or uppercase enum value) to its permission
    set. Unknown role IDs get no privileges by default — fail closed."""
    if not role_id:
        return frozenset()
    return SYSTEM_ROLE_PERMISSIONS.get(role_id) or SYSTEM_ROLE_PERMISSIONS.get(
        role_id.lower(), frozenset()
    )


def default_permissions_for(role_id: str) -> list[str]:
    """List form (sorted) for storing in DynamoDB role records."""
    return sorted(permissions_for_role_id(role_id))
