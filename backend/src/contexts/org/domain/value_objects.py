import re
from enum import Enum


class PlanTier(str, Enum):
    FREE = "FREE"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class OrgStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    # Owner initiated deletion; `deleted_at` is set. Mutation handlers
    # block via `require_not_suspended` (which covers both states so
    # pending-deletion orgs go read-only). A nightly sweeper hard-deletes
    # every tenant-scoped row 30 days after `deleted_at`.
    PENDING_DELETION = "PENDING_DELETION"


RESERVED_SLUGS = frozenset(
    {
        "www", "api", "admin", "app", "mail", "help", "docs", "status",
        "signup", "login", "cdn", "assets", "static", "staging", "dev",
        "test", "demo", "support", "blog", "home", "about", "pricing",
        "taskflow", "neurostack",
    }
)

_SLUG_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]{2,29}")


def is_valid_slug(slug: str) -> bool:
    """Workspace codes: 3-30 chars, lowercase alphanumeric + hyphen, must start with alphanumeric, not reserved."""
    if not slug or slug in RESERVED_SLUGS:
        return False
    return bool(_SLUG_PATTERN.fullmatch(slug))
