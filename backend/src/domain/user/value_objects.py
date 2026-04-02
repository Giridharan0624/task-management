from enum import Enum


class SystemRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


# Roles that can manage users, projects, tasks (OWNER + ADMIN)
PRIVILEGED_ROLES = (SystemRole.OWNER.value, SystemRole.ADMIN.value)
