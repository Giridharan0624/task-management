from enum import Enum


class SystemRole(str, Enum):
    OWNER = "OWNER"
    CEO = "CEO"
    MD = "MD"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


# Roles with full system access (same privileges as OWNER)
TOP_TIER_ROLES = (SystemRole.OWNER, SystemRole.CEO, SystemRole.MD)
TOP_TIER_VALUES = (SystemRole.OWNER.value, SystemRole.CEO.value, SystemRole.MD.value)

# Roles that can manage users, projects, tasks (OWNER + CEO + MD + ADMIN)
PRIVILEGED_ROLES = (*TOP_TIER_VALUES, SystemRole.ADMIN.value)
