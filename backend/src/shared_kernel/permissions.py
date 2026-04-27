"""Phase 4 — permission enforcement helpers.

Every sensitive handler/use case decides access through one of three
public checks in this module. All three consult the **live per-tenant
DynamoDB role record** (with a short-TTL in-memory cache), so a
permission edit in `/settings/roles` takes effect across every Lambda
container within `_CACHE_TTL_SECONDS` — no redeploy needed.

Public helpers:

- `require(ctx, perm)`          raises `AuthorizationError` when missing
- `has_permission(ctx, perm)`   bool, never raises (UI-mode checks)
- `has_permission_for_role(role, perm)`
                                bool, for call sites that only carry a
                                role-string (uses the current-org
                                ContextVar to scope the DDB lookup).
- `role_has(role, perm)`        DEPRECATED alias for
                                `has_permission_for_role`, kept so
                                existing imports compile. New code
                                should use the explicit name.

Cache model: `_PERMISSION_CACHE` keyed by `(org_id, role_id)` stores
a tuple `(perms, cached_at_epoch_seconds)`. Entries are considered
fresh for `_CACHE_TTL_SECONDS`; after that, the next lookup re-reads
DynamoDB. `invalidate_role_cache()` is still called by role-edit
handlers to drop the current container's entries immediately, but
the TTL is the real safety net — other warm containers (which the
edit-handler's `invalidate_role_cache` call cannot reach) see the
new permissions on their next lookup past the TTL.

Fail-closed: unknown role_ids resolve to the empty permission set, so
a misconfigured user is automatically read-only.
"""
from __future__ import annotations

import json
import time
from typing import Optional

from shared_kernel.auth_context import AuthContext
from shared_kernel.errors import AuthorizationError
from shared_kernel.tenant_keys import get_current_org_id, org_pk, role_sk


# Short enough that permission edits feel responsive (worst-case
# propagation delay across all warm containers is bounded by this).
# Long enough that hot handlers (tasks list, for example) don't hit
# DynamoDB on every invocation. 60s strikes the right balance — the
# DDB read amortizes to ~1 per minute per (tenant × role × container).
_CACHE_TTL_SECONDS = 60


# Per-process cache: `{ (org_id, role_id) → (frozenset[str], cached_at) }`.
# Keys are scoped to `(org, role)` so a role rename in tenant A never
# resolves for tenant B. Value is a tuple so we can expire entries by
# age without a parallel timestamp map.
_PERMISSION_CACHE: dict[tuple[str, str], tuple[frozenset[str], float]] = {}


def has_permission(ctx: AuthContext, permission: str) -> bool:
    """Pure check — returns True/False, never raises. Use for soft
    decisions like UI-mode rendering. For enforcement, use `require()`."""
    return permission in _resolve_permissions_for_role(ctx.org_id, _role_id_for(ctx))


def has_permission_for_role(role_id_or_system_role: str, permission: str) -> bool:
    """Live-lookup variant for call sites that only have a role string
    (legacy use-case signatures that receive `caller_system_role: str`).

    Reads the current org_id from the tenant ContextVar — which
    `extract_auth_context()` sets on every authenticated request — so
    the DDB role record for THIS tenant is consulted, not a static map.
    When called outside a request context (scheduled jobs, cold start
    helpers), falls back to the default-role static map.
    """
    role_id = (role_id_or_system_role or "").strip()
    if not role_id:
        return False
    org_id = get_current_org_id()
    return permission in _resolve_permissions_for_role(org_id, role_id)


def role_has(role_id_or_system_role: str, permission: str) -> bool:
    """DEPRECATED alias for `has_permission_for_role`. Originally read
    a hardcoded static map; now routes to the live DDB-backed helper so
    existing `role_has(role, P.FOO)` call sites respect tenant edits
    without needing to change their import.

    Prefer `has_permission_for_role` in new code — the name makes the
    live-lookup behavior obvious.
    """
    return has_permission_for_role(role_id_or_system_role, permission)


def require(ctx: AuthContext, permission: str) -> None:
    """Raise AuthorizationError if the caller lacks `permission`.

    Failing closed — unknown roles get the empty permission set, so a
    misconfigured user can never accidentally do anything privileged.
    """
    if not has_permission(ctx, permission):
        raise AuthorizationError(
            f"You don't have permission to '{permission}'."
        )


def require_email_verified(ctx: AuthContext) -> None:
    """Block the action when the caller's email is not verified."""
    if not ctx.email_verified:
        from shared_kernel.errors import EmailNotVerifiedError
        raise EmailNotVerifiedError()


def require_feature(ctx: AuthContext, feature: str) -> None:
    """Block the handler when the caller's tenant has the named feature
    disabled in OrgSettings.

    Backend half of the FeatureGate UI pattern. The frontend hides
    affordances behind `<FeatureGate feature="X">`, but a direct API
    call (curl, stale cached page, custom script) still hits the
    handler — this guard makes the disable actually disable.

    Fail-OPEN on lookup error: a DDB hiccup or a missing settings record
    (pre-Phase-3 tenant) lets the action through. Closing here would
    mean a transient outage reads as "all features disabled", which is
    much worse than a brief window where a disabled feature still
    works. Same shape as `require_not_suspended`.
    """
    from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
    from shared_kernel.errors import FeatureDisabledError

    try:
        settings = OrgDynamoRepository().get_settings(ctx.org_id)
    except Exception:
        return
    if settings is None:
        return
    if settings.features.get(feature, True) is False:
        raise FeatureDisabledError(feature)


def require_not_suspended(ctx: AuthContext) -> None:
    """Block writes when the tenant is suspended or scheduled for
    deletion. See the docstring on the typed error classes in
    `shared_kernel.errors` for the frontend semantics of each code."""
    from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
    from shared_kernel.errors import OrgPendingDeletionError, OrgSuspendedError

    try:
        org = OrgDynamoRepository().find_by_id(ctx.org_id)
    except Exception:
        return  # DB hiccup — don't block the user
    if org is None:
        return
    status = getattr(org, "status", None)
    status_value = status.value if hasattr(status, "value") else str(status)
    if status_value == "SUSPENDED":
        raise OrgSuspendedError(
            "This workspace is currently suspended. "
            "Contact the platform operator to resume activity.",
        )
    if status_value == "PENDING_DELETION":
        raise OrgPendingDeletionError()


def invalidate_role_cache(org_id: Optional[str] = None) -> None:
    """Drop cached entries so the NEXT lookup hits DynamoDB. Called by
    role-edit handlers immediately after a write. Only reliably clears
    the current container's entries — other warm containers rely on
    the `_CACHE_TTL_SECONDS` TTL to pick up the change.

    Pass `org_id` to scope the eviction; pass nothing to clear all.
    """
    if org_id is None:
        _PERMISSION_CACHE.clear()
        return
    for key in [k for k in _PERMISSION_CACHE if k[0] == org_id]:
        _PERMISSION_CACHE.pop(key, None)


# ----------------------------------------------------------------------
# Internals
# ----------------------------------------------------------------------


def _role_id_for(ctx: AuthContext) -> str:
    """Prefer the Phase-4 role_id claim when the pre-token trigger
    injected it; fall back to the legacy system_role string for tokens
    issued before the trigger update. Both forms resolve via the same
    `_resolve_permissions_for_role` path."""
    return (getattr(ctx, "role_id", "") or ctx.system_role or "").strip()


def _resolve_permissions_for_role(org_id: str, role_id: str) -> frozenset[str]:
    """Look up the permission set for `(org_id, role_id)`. Consults
    the in-process cache first (subject to TTL); misses / expired
    entries hit DynamoDB. An unknown role_id (neither in DDB nor in
    the static default map) resolves to the empty set — fail-closed."""
    if not role_id:
        return frozenset()

    cache_key = (org_id, role_id)
    cached = _PERMISSION_CACHE.get(cache_key)
    now = time.monotonic()
    if cached is not None:
        perms, cached_at = cached
        if now - cached_at < _CACHE_TTL_SECONDS:
            return perms

    perms = _load_role_permissions(org_id, role_id)
    if perms is None:
        # No custom role record — fall through to the static default
        # map so pre-signup / pre-migration users still resolve to
        # the sensible baseline.
        from contexts.org.domain.default_roles import permissions_for_role_id
        perms = permissions_for_role_id(role_id)

    _PERMISSION_CACHE[cache_key] = (perms, now)
    return perms


def _load_role_permissions(org_id: str, role_id: str) -> Optional[frozenset[str]]:
    """Fetch the role record from DynamoDB. Returns None on miss/error
    so the caller can fall back to system-role defaults; never raises."""
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
