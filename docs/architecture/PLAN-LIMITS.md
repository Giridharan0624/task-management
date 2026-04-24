# TaskFlow — Plan Limits & Feature Gating

> How TaskFlow restricts capacity (seats, projects, retention) and capability (per-feature flags) based on a tenant's plan tier. This document is the design reference for current enforcement and the playbook for adding new gated features.
>
> **Last updated:** 2026-04-24 · Audit-anchored against `backend/src/contexts/org/domain/plans.py` and the four enforcement call sites listed in §4.

---

## 1. Tiers and what they include

Defined in `backend/src/contexts/org/domain/plans.py`. Three tiers, three numeric caps, one feature-allowlist set per tier.

| Tier | `max_users` | `max_projects` | `retention_days` | Adds these features over the previous tier |
|---|---|---|---|---|
| **FREE** | 10 | 3 | 30 | `birthday_wishes`, `activity_monitoring`, `ai_summaries`, `day_offs`, `comments`, `task_updates` |
| **PRO** | 50 | 50 | 365 | `screenshots`, `custom_pipelines`, `custom_roles`, `api_access` |
| **ENTERPRISE** | `None` (∞) | `None` (∞) | `None` (forever) | `sso`, `audit_logs`, `white_label`, `custom_domain` |

`None` means **unlimited** — every enforcement helper short-circuits when the cap is `None`, so Enterprise customers never trip a check.

The `Plan` entity itself is stored at `PK=ORG#{org}` / `SK=PLAN`. It is the **single source of truth** at runtime; the templates in `plans.py` are only used to seed a new org and to handle upgrades/downgrades.

---

## 2. Two kinds of restriction

| Kind | Examples | How it's enforced |
|---|---|---|
| **Capacity caps** | seats, projects, retention | A counter is compared against `plan.max_*` at write-time, or a sweeper deletes expired rows |
| **Feature flags** | screenshots, custom roles, SSO | A handler checks `feature in plan.features_allowed` before executing |

The two kinds use the same plan record and the same shared helper (§5), but they answer different questions: "do you have room?" vs. "are you allowed to use this at all?"

---

## 3. The model — why caps are write-time and retention is sweeper-time

Capacity caps (`max_users`, `max_projects`) are enforced **at the moment a new row is created**. This is by design:

- The user gets immediate, actionable feedback ("Your FREE plan is limited to 10 users — upgrade to add more") instead of a silent reconciliation later.
- It avoids the awkward state where a row exists in the database but the customer has been billed, or vice versa.
- It scales — the check is one read on a hot path, not a periodic full scan.

Retention (`retention_days`) is enforced **by a nightly sweeper**, because the alternative — refusing reads of old data — is the wrong UX. Old data being present is harmless; old data being deleted on a predictable schedule is what compliance needs.

Feature flags follow the capacity-cap model: enforced at handler entry so the user gets a clean error response.

---

## 4. What is enforced today

Four call sites already follow the pattern. New gates should match this shape.

### 4.1 Seat cap — `max_users`

- **`backend/src/contexts/user/application/use_cases.py:183-196`** — `CreateUserUseCase`
- **`backend/src/contexts/org/application/invite_use_cases.py:90-103`** — `SendInviteUseCase`

Both load the plan, count `existing_users + pending_invites`, and raise:

```python
raise ValidationError(
    f"Your {plan.tier.value} plan is limited to {plan.max_users} users. "
    "Upgrade to add more."
)
```

Pending invites are counted so a tenant cannot blow past the cap by issuing 1000 invites and waiting for them to be accepted later.

### 4.2 Project cap — `max_projects`

- **`backend/src/contexts/project/application/use_cases.py:70-79`** — `CreateProjectUseCase`

Same pattern: load plan, count existing projects, reject if at or over cap.

### 4.3 Retention — `retention_days`

- **`backend/src/contexts/activity/handlers/retention_sweeper.py`** — nightly Lambda (EventBridge → Lambda)

Walks every org. For each: `cutoff = now - timedelta(days=plan.retention_days)`, deletes any rows with `SK < cutoff` in 25-row `BatchWriteItem` chunks. Skips Enterprise (`retention_days=None`).

> **Known gap:** the sweeper currently deletes only `ACTIVITY#` rows, not `EVENT#` (audit-log) rows. The pricing page advertises retention on the audit log; closing this gap means extending the filter at `retention_sweeper.py:91-95` to also match `SK begins_with "EVENT#"` and operate on the audit partition (`PK = ORG#{org}#AUDIT`).

### 4.4 Feature flag — `screenshots`

- **`backend/src/contexts/upload/handlers/presign.py:133-158`** — presigned-URL handler

When the desktop app requests a presigned URL for a screenshot upload, the handler loads the plan, checks `"screenshots" in plan.features_allowed`, and rejects with `ValidationError` if absent. **Best-effort fail-open** — a transient DDB error allows the upload through rather than blocking real work; the audit log catches abuse.

This is the only feature flag actively gated today. Every other entry in `plans.py:features_allowed` is declared but unenforced.

### 4.5 Belt-and-braces: nightly seat reconciliation

- **`backend/src/contexts/org/handlers/seat_reconciliation.py`** — nightly Lambda

Detects tenants that raced past their seat cap (e.g., two simultaneous invite-accepts hit between cap checks) and writes a `plan.seats_overflow` audit event. **Does not auto-suspend or auto-delete users** — escalation is intentionally manual via support.

---

## 5. Proposed shared helper — `shared_kernel/plan_limits.py`

The four enforcement sites duplicate the same load-plan-check-raise boilerplate. As more features get gated this becomes a problem. The fix is one new file.

```python
# backend/src/shared_kernel/plan_limits.py
"""Plan-aware checks for handlers and use cases.

Mirrors the shape of `shared_kernel/permissions.require(...)` so the
mental model is consistent: one line at the top of a handler, raises
ValidationError if the plan does not permit the action.
"""
from __future__ import annotations

import logging
from typing import Optional

from contexts.org.domain.entities import Plan
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.errors import ValidationError

log = logging.getLogger("taskflow.plan_limits")


def _load(org_id: str) -> Optional[Plan]:
    """Best-effort plan lookup. Returns None on transient DDB errors so
    a degraded read does not block the user's primary action."""
    try:
        return OrgDynamoRepository().get_plan(org_id)
    except Exception as e:
        log.warning("plan-load-failed-open", extra={"org_id": org_id, "error": str(e)[:200]})
        return None


def require_feature(org_id: str, feature: str) -> None:
    """Raise ValidationError if the org's plan does not include `feature`.
    Plans where the lookup itself failed fall open — see `_load()`."""
    plan = _load(org_id)
    if plan is None or feature in plan.features_allowed:
        return
    raise ValidationError(
        f"This action requires a plan that includes \"{feature}\". "
        f"Your {plan.tier.value} plan does not — upgrade to enable it."
    )


def require_seat(org_id: str, current_count: int, pending: int = 0) -> None:
    """Raise if the seat cap would be exceeded. `pending` covers
    unaccepted invites so a tenant can't blow past the cap by issuing
    invites in bulk."""
    plan = _load(org_id)
    if plan is None or plan.max_users is None:
        return
    if current_count + pending >= plan.max_users:
        raise ValidationError(
            f"Your {plan.tier.value} plan is limited to {plan.max_users} users. "
            "Upgrade to add more."
        )


def require_project_slot(org_id: str, current_count: int) -> None:
    """Raise if the project cap would be exceeded."""
    plan = _load(org_id)
    if plan is None or plan.max_projects is None:
        return
    if current_count >= plan.max_projects:
        raise ValidationError(
            f"Your {plan.tier.value} plan is limited to {plan.max_projects} projects. "
            "Upgrade to add more."
        )
```

### Why this shape

It mirrors the existing `require(auth, P.X)` from `shared_kernel/permissions.py` — same call signature pattern, same exception class, same handler-top placement. Engineers don't have to learn a new mental model.

```python
def handler(event, context):
    auth = extract_auth_context(event)
    require_not_suspended(auth)
    require_email_verified(auth)
    require(auth, P.ROLE_MANAGE)              # permission gate (RBAC)
    plan_limits.require_feature(auth.org_id, "custom_roles")  # plan gate
    ...
```

### Why fail-open

A degraded plan-lookup is a TaskFlow problem, not a customer problem. Falling open means transient DDB issues don't manifest as "I can't invite users" alerts. The seat-reconciliation sweeper catches anything that slips through.

---

## 6. Where new gates need to slot in

| Feature | Tier | Add `require_feature(...)` to |
|---|---|---|
| `custom_roles` | PRO+ | `org/handlers/create_role.py`, `update_role.py` |
| `custom_pipelines` | PRO+ | `org/handlers/create_pipeline.py`, `update_pipeline.py` (in `pipelines_router.py`) |
| `api_access` | PRO+ | future personal-access-token handlers (not yet built) |
| `audit_logs` | ENTERPRISE | `org/handlers/list_audit_events.py` (currently permission-only) |
| `sso` | ENTERPRISE | future SSO config handler (not yet built) |
| `white_label` | ENTERPRISE | `org/handlers/update_settings.py` — gate the `logo_url` / `favicon_url` / `primary_color` / `accent_color` fields |
| `custom_domain` | ENTERPRISE | future custom-domain handler (not yet built) |

Adding a gate is a one-line change once the helper exists. Tests should cover (a) FREE rejected, (b) PRO/ENTERPRISE allowed, (c) DDB-failure fall-open.

---

## 7. Frontend mirror — soft-gating in the UI

Backend enforcement is the source of truth. The frontend should also **soft-gate** so users don't hit dead ends. Pattern:

```tsx
// hook
import { useTenant } from '@/lib/tenant/TenantProvider'

export function usePlanFeatures() {
  const { current } = useTenant()
  const features = new Set(current?.plan?.featuresAllowed ?? [])
  return {
    has: (f: string) => features.size === 0 || features.has(f),
    plan: current?.plan?.tier ?? 'FREE',
  }
}
```

Two new components:

```tsx
// <FeatureGate feature="custom_roles">{children}</FeatureGate>
//   — renders children if allowed, else <UpgradePrompt>.
// <UpgradePrompt feature="Custom roles" requiredPlan="Pro" />
//   — small inline pill linking to /settings/plan.
```

The existing `<PlanLimitBanner>` already covers seat/project usage at >=80 % capacity. `<FeatureGate>` extends the same idea to feature flags.

### Why both backend and frontend

- **Backend = security.** A user can always craft an HTTP request directly; the server is the only thing that protects the limit.
- **Frontend = UX.** Showing a disabled button with an upgrade tooltip is dramatically better than letting the user fill out a form and hit a 400.

If the two ever disagree, the backend wins — a frontend showing a feature that the server rejects is acceptable (annoying but safe). The reverse is not.

---

## 8. Plan upgrades / downgrades

Today plans only mutate via direct DynamoDB writes. To take this to production you need one of:

- **Stripe webhook** — `org/handlers/stripe_webhook.py` listens for `customer.subscription.updated`, looks up the org by Stripe customer ID, mutates `plan.tier` + `features_allowed`, fires `plan.upgraded` / `plan.downgraded` audit events.
- **Internal admin route** — `platform/handlers/set_plan.py`, similar pattern to the existing `set_org_features.py`. Useful for hand-grants and beta upgrades.

Either way, the plan record is the single source of truth — every enforcement helper just reads `plan.features_allowed` and `plan.max_*`. Adding a new tier is a `plans.py` template change; no enforcement code needs to know.

### Plan-change audit trail

Both upgrade paths must emit one of:

```python
audit.record(auth, action=audit.PLAN_UPGRADED, target={"type": "plan", "id": auth.org_id}, ...)
audit.record(auth, action=audit.PLAN_DOWNGRADED, target={"type": "plan", "id": auth.org_id}, ...)
```

These constants are already declared in `shared_kernel/audit.py:69-70`. The audit-log UI already understands them.

---

## 9. Adding a new gated feature — the playbook

1. **Declare it.** Add the string to the appropriate tier set in `plans.py` (FREE / PRO / ENTERPRISE).
2. **Gate it server-side.** Add `plan_limits.require_feature(auth.org_id, "your_feature")` to the top of every handler that creates or modifies the gated resource.
3. **Test it.** Three pytests — FREE rejected, PRO allowed, DDB-failure fall-open — in `backend/tests/test_plan_limits_<feature>.py`.
4. **Soft-gate it client-side.** Wrap the relevant UI in `<FeatureGate feature="your_feature">` so FREE users see an `<UpgradePrompt>` instead of a dead button.
5. **Document it.** Add the row to §6 above and to the pricing page tier description in `frontend/src/app/page.tsx`.
6. **Migrate existing tenants.** Plans live in DynamoDB, not code — when you add a feature to a tier, existing PLAN records DO NOT auto-upgrade. Run a one-time backfill script (`scripts/backfill_plan_features.py`) that adds the feature string to the `features_allowed` set on every PLAN row whose `tier` matches.

The migration step (6) is the easy thing to forget. Test it on staging by running the backfill, then opening a tenant that existed before the feature was added — the new gate should permit them.

---

## 10. Suggested rollout order

1. **Build `shared_kernel/plan_limits.py`** with the three helpers. Refactor the four existing call sites (CreateUser, SendInvite, CreateProject, presign) into one-liners. Behaviour-neutral; pure deduplication. Adds tests for fall-open.
2. **Gate `custom_roles` + `custom_pipelines`** at PRO. Lowest risk because the features already exist in the product and FREE users can already see they exist (visible in `/settings/roles`).
3. **Add `<FeatureGate>` + `<UpgradePrompt>`** on the frontend. Start by hiding the "New role" button on FREE.
4. **Extend `retention_sweeper`** to include `EVENT#` audit-log rows so the pricing claim is true.
5. **Wire Stripe** when you're ready to take payments. Keep plan changes manual until then; the helper library is plan-source-agnostic.

---

## Cross-references

- **`backend/src/contexts/org/domain/plans.py`** — tier templates, feature sets
- **`backend/src/contexts/org/domain/entities.py`** — `Plan`, `OrgSettings`
- **`backend/src/contexts/org/infrastructure/dynamo_repository.py`** — `get_plan(org_id)`, `save_plan(...)`
- **`backend/src/shared_kernel/permissions.py`** — RBAC pattern this design mirrors
- **[RBAC-DOCUMENTATION.md](RBAC-DOCUMENTATION.md)** — permission system (different concern, same shape)
- **[../saas/SAAS-MIGRATION.md](../saas/SAAS-MIGRATION.md)** — multi-tenant context this all sits inside
