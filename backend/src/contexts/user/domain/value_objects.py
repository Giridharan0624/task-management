from enum import Enum


class SystemRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


# Deprecated — Phase 4 moved to permission-based checks.
# Use `shared_kernel.permissions.role_has(role, P.SOME_PERMISSION)` or
# `require(ctx, P.SOME_PERMISSION)` in handlers. Constant kept only as a
# compat shim for any out-of-tree callers; no internal code references it.
PRIVILEGED_ROLES = (SystemRole.OWNER.value, SystemRole.ADMIN.value)
