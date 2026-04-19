"""Phase 4 — `require(ctx, permission)` shared helper.

Replaces ad-hoc `if auth.system_role not in PRIVILEGED_ROLES:` checks
scattered across handlers/use cases. Resolves permissions from:

1. The user's role record stored under `PK=ORG#{org}` `SK=ROLE#{role_id}`
   (per-tenant custom roles, the Phase 4 model), then falling back to
2. The legacy `SystemRole` enum value carried on `AuthContext.system_role`
   mapped via `default_roles.permissions_for_role_id`.

Lookups are cached for the duration of a Lambda invocation in a tiny
in-memory dict so a handler making 5 `require()` calls only fetches the
role record once.
"""
from __future__ import annotations

import json
from typing import Optional

from shared_kernel.auth_context import AuthContext
from shared_kernel.errors import AuthorizationError
from shared_kernel.tenant_keys import org_pk, role_sk


# Per-process cache: { (org_id, role_id) → frozenset[str] }.
# Lambdas reuse warm processes for many invocations, so this avoids a
# DynamoDB get per `require()` call. Keys are scoped to (org, role) so a
# role rename in tenant A never resolves for tenant B.
_PERMISSION_CACHE: dict[tuple[str, str], frozenset[str]] = {}


def has_permission(ctx: AuthContext, permission: str) -> bool:
    """Pure check — returns True/False, never raises. Use for soft
    decisions like UI-mode rendering. For enforcement, use `require()`."""
    return permission in _resolve_permissions(ctx)


def require(ctx: AuthContext, permission: str) -> None:
    """Raise AuthorizationError if the caller lacks `permission`.

    Failing closed — unknown roles get the empty permission set, so a
    misconfigured user can never accidentally do anything privileged.
    """
    if permission not in _resolve_permissions(ctx):
        raise AuthorizationError(
            f"You don't have permission to '{permission}'."
        )


def invalidate_role_cache(org_id: Optional[str] = None) -> None:
    """Clear the in-process permission cache. Call after editing a role
    record so subsequent `require()` calls re-fetch fresh permissions.
    Pass `org_id` to scope the eviction; pass nothing to clear all."""
    if org_id is None:
        _PERMISSION_CACHE.clear()
        return
    for key in [k for k in _PERMISSION_CACHE if k[0] == org_id]:
        _PERMISSION_CACHE.pop(key, None)


def _resolve_permissions(ctx: AuthContext) -> frozenset[str]:
    # Prefer the Phase-4 role_id when the pre-token trigger injected it;
    # fall back to the legacy system_role string for tokens issued before
    # the trigger update. Both forms resolve via the same lookup path.
    role_id = (getattr(ctx, "role_id", "") or ctx.system_role or "").strip()
    if not role_id:
        return frozenset()

    cache_key = (ctx.org_id, role_id)
    cached = _PERMISSION_CACHE.get(cache_key)
    if cached is not None:
        return cached

    perms = _load_role_permissions(ctx.org_id, role_id)
    if perms is None:
        # No custom role record — fall through to system-role defaults.
        from contexts.org.domain.default_roles import permissions_for_role_id
        perms = permissions_for_role_id(role_id)

    _PERMISSION_CACHE[cache_key] = perms
    return perms


def _load_role_permissions(org_id: str, role_id: str) -> Optional[frozenset[str]]:
    """Fetch the role record from DynamoDB. Returns None on miss/error so
    the caller can fall back to system-role defaults; never raises."""
    try:
        from shared_kernel.dynamo_client import get_table
        # Try lowercase first (canonical), then the raw id (handles legacy
        # uppercase enum values stored in older tokens).
        for candidate in (role_id.lower(), role_id):
            res = get_table().get_item(
                Key={"PK": org_pk(org_id), "SK": role_sk(candidate)}
            )
            item = res.get("Item")
            if not item:
                continue
            raw = item.get("permissions")
            if isinstance(raw, str):
                perms = json.loads(raw or "[]")
            elif isinstance(raw, (list, set)):
                perms = list(raw)
            else:
                perms = []
            return frozenset(perms)
    except Exception:
        return None
    return None
