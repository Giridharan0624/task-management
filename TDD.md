# TaskFlow — Technical Design Document

**Scope:** how the multi-tenant SaaS is built. Complements [PRD.md](PRD.md) (product surface) and [docs/saas/SAAS-STATUS.md](docs/saas/SAAS-STATUS.md) (shipped vs. not).
**Version:** 2.4 (post-Session 9)
**Last updated:** 2026-04-30

---

## 1. System diagram

```
                              ┌─────────────────────────────────────────────────┐
                              │                   AWS (ap-south-1)              │
                              │                                                 │
  ┌──────────┐     HTTPS      │  ┌───────┐     ┌──────────────────────────┐    │
  │  Web     │────────────────│──│  API  │─────│   Lambda (~50 fn)        │    │
  │ Next 16  │  JWT (Bearer)  │  │  GW   │     │   Python 3.12 + DDD      │    │
  │ Vercel   │                │  │ REST  │     │   parent + 2 nested      │    │
  └──────────┘                │  └───┬───┘     └─────┬─────┬─────┬────────┘    │
        ▲                     │      │WAFv2         │     │     │             │
        │                     │   rate-limit        │     │     │             │
  ┌──────────┐                │  ┌───┴────┐  ┌─────▼───┐ │  ┌──▼─────────┐   │
  │ Desktop  │────────────────│──│Cognito │  │ DynamoDB│ │  │ S3 + CDN   │   │
  │ Wails v2 │  JWT (SRP)     │  │  Pool  │  │ 1 table │ │  │ avatars +  │   │
  │ Go+Preact│                │  │+PreTok │  │ +2 GSI  │ │  │ screenshots│   │
  └──────────┘                │  └────────┘  └─────────┘ │  └────────────┘   │
                              │                          │                    │
                              │  ┌──────────────┐  ┌─────▼────────┐          │
                              │  │ CloudWatch   │  │ Secrets Mgr  │          │
                              │  │ 5 alarms     │  │ Gmail + Groq │          │
                              │  └──────────────┘  └──────────────┘          │
                              └─────────────────────────────────────────────────┘
```

---

## 2. Deployment units

Three deployable units in one monorepo:

| Unit | Language | Host | Release cadence |
|---|---|---|---|
| `backend/` | Python 3.12 | AWS Lambda behind API Gateway REST | `cdk deploy` |
| `frontend/` | Next.js 16 (App Router) | Vercel | `git push` → Vercel auto-deploy |
| `desktop/` | Go 1.22 + Wails v2 + Preact | GitHub releases (separate repo, gitignored here) | tag push → GitHub Actions builds Win/Linux/macOS |

### Stages (updated Session 9)
- **Staging V2** (active): company AWS account, `--profile company`, `app_staging.py` entry point. All non-customer-facing development lands here. Has the integration platform. Personal-account staging stack was destroyed 2026-04-30 — `app_staging.py` may still exist in the repo but the legacy stack it deployed is gone.
- **Production V2**: company AWS account, `--profile company`, `app_company_v2.py` entry point. Promotes from V2 staging after explicit verification. Has the integration platform.
- **Production (legacy)**: company AWS account, `--profile company`, `app.py` / `app_company.py`. Has live users — **no work touches the `taskflow` legacy stack** until the user explicitly says "cut over to legacy prod" (see `no-touch-legacy-taskflow` memory in CLAUDE.md).
- Promotion order: V2 staging → V2 prod → (verify) → legacy prod cutover, gated by explicit user authorization.

---

## 3. Multi-tenant data model

### Single DynamoDB table

All tenant-scoped items prefix `ORG#{org_id}#` in their PK. Key construction is **centralized** in [backend/src/shared_kernel/tenant_keys.py](backend/src/shared_kernel/tenant_keys.py) — repositories never string-format PKs inline.

```
PK=ORG#{org}#USER#{userId}        SK=PROFILE | NOTIF#{ts}#{id}
PK=ORG#{org}#PROJECT#{pid}        SK=METADATA | MEMBER#{uid} | TASK#{tid}
PK=ORG#{org}                      SK=ORG | SETTINGS | PLAN
PK=ORG#{org}                      SK=ROLE#{id} | PIPELINE#{id} | INVITE#{token}
PK=ORG#{org}                      SK=WEBHOOK#{id}
PK=ORG#{org}#AUDIT                SK=EVENT#{ts}#{eventId}
PK=ORG#{org}#ACTIVITY             SK=...
PK=SLUG#{slug}                    SK=ORG              # global resolver
PK=INVITE_TOKEN#{token}           SK=LOOKUP           # global, O(1) accept
GSI1PK=USER_EMAIL#{email}                             # email uniqueness
GSI2PK=ORG#{org}#EMPLOYEE#{eid}                       # per-tenant employee IDs
```

### Role scope (Session 4)
`ROLE#{id}` records carry a `scope` attribute: `"system"` (OWNER / ADMIN / MEMBER and custom system roles) or `"project"` (project_admin / project_manager / team_lead / project_member and custom project roles). `ProjectMember.project_role_id` references the latter — the legacy `project_role` enum is translated on read via `normalize_project_role_id()` and emitted alongside the new field on write for backward compat.

`DEFAULT_ORG_ID = "neurostack"` is the legacy fallback when a token lacks `custom:orgId`. New code emits v2 keys only.

### Aggregate keys are forbidden
No `ORG#{id}#USER#LIST` or similar — they concentrate writes on one partition. Always query scoped PKs.

### `OrgSettings.features` evolution (Sessions 8 + 9)
The `features` dict on `OrgSettings` is the per-tenant feature-toggle map. Originally seven booleans (`birthday_wishes`, `activity_monitoring`, `screenshots`, `ai_summaries`, `day_offs`, `comments`, `task_updates`). Session 8 added three onboarding-state booleans:

```python
"onboarding_checklist_dismissed": False,
"onboarding_desktop_installed": False,
"onboarding_branding_done": False,
```

These back the dashboard's [SetupChecklist](frontend/src/components/dashboard/SetupChecklist.tsx) so dismissal and per-step ticks survive across browsers/devices. Reusing `features` (rather than adding a new `OrgSettings.onboarding` field) keeps the surface flat — the existing `PUT /orgs/current/settings` handler accepts the field unchanged. Caveat: the partial-update merge in `model_copy(update=...)` REPLACES the whole `features` dict, so writers MUST send `{...current.settings.features, [key]: value}` rather than just the changed pair.

### `OrgSettings` new fields (Session 9)
Three new top-level scalars/lists added to the entity, all accepting partial updates via `PUT /orgs/current/settings`:

```python
theme: str            # curated preset id from frontend/src/lib/tenant/themes.ts (default 'aurora')
font_family: Optional[str]  # curated id from frontend/src/lib/tenant/fonts.ts (None = default Outfit)
departments: list[str]      # OWNER-managed department catalog (empty list is a valid choice)
```

- `theme` replaces the old standalone `primary_color` / `accent_color` swatches as the canonical colour surface. The five presets each carry a full light + dark palette (background, card, primary, accent, sidebar). `applyThemePreset(themeId)` writes every CSS variable for the active mode at once. The legacy `primary_color` / `accent_color` fields stay on the entity for backward compatibility but are no longer applied at runtime.
- `font_family` is a stable id, not a CSS string — the frontend's `applyTenantFont(id)` lazy-loads the corresponding stylesheet via an injected `<link>` and sets the `--font-tenant` CSS variable. Falls back to Outfit (the next/font-bundled default) when null.
- `departments` is parsed from JSON-stringified DDB attribute. Empty list IS a valid OWNER choice (a workspace might not need departments at all), so the mapper only restores defaults when the attribute is missing or unparseable. Persistent OWNER-controlled list drives the user-create form Department dropdown and the admin Users page filter.

### Plan-tier gating evolution (Session 9)
`require_feature(ctx, feature)` was extended to gate against `plan.features_allowed` BEFORE checking `OrgSettings.features`:

```python
def require_feature(ctx, feature):
    plan = repo.get_plan(ctx.org_id)
    if plan and feature not in plan.features_allowed:
        raise PlanFeatureLockedError(feature)   # code: PLAN_FEATURE_LOCKED
    settings = repo.get_settings(ctx.org_id)
    if settings.features.get(feature, True) is False:
        raise FeatureDisabledError(feature)     # code: FEATURE_DISABLED
```

`PlanFeatureLockedError` is a new typed exception — distinct from `FeatureDisabledError` because the remediation is different (upgrade plan vs. flip a toggle). The frontend uses the code to show an "Upgrade to PRO" upsell modal instead of the generic "feature disabled" copy. Both gates fail-open on lookup errors to keep the same posture as `require_not_suspended` — a transient DDB hiccup must not look like "all features off."

`<FeatureGate>` and `useFeatureFlag()` mirror this on the frontend via a shared `isFeatureAvailable()` helper that checks plan AND settings.

### PITR
Enabled on both stages. Staging: 7-day retention. Prod: 35-day. Uses `PointInTimeRecoverySpecification` (not the deprecated `point_in_time_recovery=True`).

---

## 4. Auth flow

### Pooled Cognito
One user pool, one client ID, shared across all tenants. Users from different tenants can coexist with the same email because email is not a sign-in alias — it's just a profile attribute. Login uses `email` + `password`.

### JWT claims
- `sub` — user_id
- `email`, `email_verified` — standard OIDC
- `custom:orgId` — immutable tenant binding, set by signup / backfill
- `custom:systemRole` — role ID (owner/admin/member or custom)
- `custom:roleId` — derived lowercase canonical form (Phase 4)

### Pre-token-generation trigger
[backend/src/contexts/org/handlers/pre_token_trigger.py](backend/src/contexts/org/handlers/pre_token_trigger.py) runs on every token issuance — **pure function, 5-second timeout**, no DB access, no heavy imports. Injects the three `custom:*` claims on every ID token.

### AuthContext + ContextVar propagation
Every authenticated handler's first line:

```python
auth = extract_auth_context(event)   # shared_kernel/auth_context.py
```

`extract_auth_context` reads JWT claims, re-reads the authoritative `system_role` from DynamoDB (so role changes take effect without re-login), and **sets `org_id` into a ContextVar** so every repository instantiated later automatically scopes its reads/writes — no handler threads `org_id` manually.

### Email verification
Signup creates the Cognito user with `email_verified=false`. Invite acceptance ships `email_verified=true` (link receipt proves ownership). The `/verify-email` page calls Cognito SDK `getAttributeVerificationCode` / `verifyAttribute`; post-verify `refreshSession()` pulls a fresh token. Dashboard layout + login page both gate on `emailVerified === false` and redirect.

### TOTP 2FA (Session 3)
Pool `MfaConfiguration=OPTIONAL` with `otp=True, sms=False`. SMS is deliberately off — SIM-swap attacks make it weak for admin accounts. TOTP-only is the baseline.

Enrollment flow:
1. `associateSoftwareToken` — returns a secret seed; frontend renders a QR code (`otpauth://totp/{issuer}:{email}?secret=…`) + a manual-entry field
2. User scans into Google Authenticator / Authy / 1Password / Microsoft Authenticator
3. User enters the first generated code → `verifySoftwareToken` + `setUserMfaPreference({ PreferredMfa: true })`
4. Future sign-ins return a `SOFTWARE_TOKEN_MFA` challenge; `cognitoClient.signIn` surfaces it as a `SoftwareTokenMfaRequired` result member, `AuthProvider.completeMfaChallenge(code)` finishes the flow

OWNER reset: `POST /users/{userId}/reset-mfa` calls `AdminSetUserMFAPreference` to disable all factors on the target user, audited as `user.mfa_reset`. Escape hatch for lost authenticators; no recovery codes in v1.

### Change-email (Session 2)
Cognito owns the verification ceremony. Frontend calls `updateAttributes([{Name:'email', Value: new}])` — Cognito stages the new address, sets `email_verified=false`, mails a 6-digit code to the NEW address. User enters the code → `verifyAttribute` commits the swap. Backend `PUT /users/me/email` then syncs the DDB User record from the refreshed JWT's `email` claim. Collision check (global email uniqueness) re-verified backend-side.

---

## 5. Authorization

### Permission catalog (Phase 4)
~35 strings covering every mutation surface: `task.create`, `task.delete.any`, `task.update.own`, `project.create`, `user.invite`, `settings.edit`, `billing.view`, `role.manage`, etc. See [backend/src/contexts/org/domain/permissions.py](backend/src/contexts/org/domain/permissions.py).

### Resolution
```python
require(ctx, P.TASK_DELETE_ANY)    # raises AuthorizationError if missing
has_permission(ctx, P.TASK_VIEW)   # bool, for UI-mode decisions
role_has("admin", P.USER_INVITE)   # bool, when only a role string is available
```

`require()` resolves through:
1. Per-tenant Role record at `PK=ORG#{org} SK=ROLE#{role_id}`
2. Default role map (`default_roles.py`) as fallback

Lookups are cached per Lambda invocation in `_PERMISSION_CACHE: dict[(org_id, role_id), frozenset[str]]`. `invalidate_role_cache(org_id)` is called on every role edit so changes take effect across warm Lambdas.

### Suspension gate
`require_not_suspended(ctx)` reads the Org record once per invocation, raises typed `OrgSuspendedError(code="ORG_SUSPENDED")` on a suspended tenant. Every mutation handler calls it at the top.

### Email-verification gate (defense-in-depth)
`require_email_verified(ctx)` raises `EmailNotVerifiedError(code="EMAIL_NOT_VERIFIED")`. Helper is defined but not applied anywhere yet — frontend gate is the primary enforcement.

---

## 5b. Plan limits & feature gating

A second axis of authorisation, orthogonal to the permission system in §5. Permissions answer "is this user allowed to perform this action?"; plan limits answer "does this tenant's plan permit this action at all?"

### Two kinds of restriction
| Kind | Examples | How enforced |
|---|---|---|
| **Capacity caps** | seats (10/50/∞), projects (3/50/∞), retention (30/365/∞ days) | Counter compared against `plan.max_*` at write-time, OR sweeper deletes expired rows |
| **Feature flags** | screenshots, custom_roles, sso, white_label | Handler checks `feature in plan.features_allowed` before executing |

### Currently enforced
- `max_users` — `user/application/use_cases.py:CreateUserUseCase` and `org/application/invite_use_cases.py:SendInviteUseCase` (counts pending invites too, so a tenant can't blow past the cap by issuing 1000 invites)
- `max_projects` — `project/application/use_cases.py:CreateProjectUseCase`
- `ai_summaries` feature — `activity/handlers/generate_summary.py` (daily summaries) AND `taskupdate/handlers/weekly_rollup.py` (weekly rollup) — both gated as of Session 9. Plan-locked on FREE; raises `PLAN_FEATURE_LOCKED` for upsell.
- `screenshots` feature — `upload/handlers/presign.py` (rejects upload if absent; fail-open on DDB errors)
- `integrations` (implicit via `integrations/application/plan_gate.py`) — connector platform PRO+ only
- `retention_days` — `activity/handlers/retention_sweeper.py` (nightly EventBridge → Lambda)
- Belt-and-braces: nightly `seat_reconciliation.py` audits any race-induced overflow as `plan.seats_overflow`

### Declared but not yet enforced
`custom_roles`, `custom_pipelines`, `api_access` (PRO+); `audit_logs`, `sso`, `white_label`, `custom_domain` (ENTERPRISE). The shared helper that closes these gaps in one place is the proposed `shared_kernel/plan_limits.py` module — see [docs/architecture/PLAN-LIMITS.md](docs/architecture/PLAN-LIMITS.md) for the design, the helper API, the per-feature gating map, and the rollout order. Note: now that `require_feature()` itself does plan+settings checks (Session 9), the helper's job is mostly the per-feature wiring, not the gate-mechanism itself.

### Why fail-open
Plan lookup failures are TaskFlow problems, not customer problems. Falling open means a transient DDB error doesn't manifest as "I can't invite users." The audit log + nightly reconciler catch anything that slips through.

---

## 6. Backend architecture (DDD)

Each bounded context in [backend/src/contexts/](backend/src/contexts/) has four layers:

```
contexts/{context}/
├── domain/           # Entities, value objects, repository interfaces
├── application/      # Use cases — business logic + RBAC
├── infrastructure/   # DynamoDB repos, mappers, external services
└── handlers/         # Lambda entry points (event → usecase → response)
```

Contexts: `user`, `project`, `task`, `comment`, `attendance`, `dayoff`, `taskupdate`, `activity`, `upload`, `org`, `system`, **`integrations` (Session 9)**.

### Shared kernel
[backend/src/shared_kernel/](backend/src/shared_kernel/) holds cross-cutting concerns used by every context:

- `auth_context.py` — JWT → AuthContext + ContextVar stamp
- `tenant_keys.py` — PK/SK builders
- `permissions.py` — require / has_permission / require_not_suspended / require_email_verified
- `errors.py` — typed exceptions with `code` field
- `response.py` — CORS-aware success/error envelope
- `validate_body.py` — Pydantic parse with JSON error handling
- `audit.py` — audit writer/reader
- `captcha.py` — hCaptcha siteverify wrapper
- `observability.py` — Sentry cold-start init
- `dynamo_client.py` — single boto3 resource, reused across repos

---

## 7. CDK stack topology

Parent stack owns the stateful resources. Two nested stacks absorb handler Lambdas to stay under the 500-resource CloudFormation cap.

```
TaskManagementStack (parent, ~475/500 resources)
├── DynamoDB Table + 2 GSI + PITR       ← stateful
├── Cognito UserPool + Client + PreTokenTrigger  ← stateful
├── S3 Bucket + CloudFront Distribution  ← stateful
├── API Gateway RestApi + Authorizer     ← owns api.root
├── WAFv2 WebACL + Association           ← regional rate-limit
├── 5 CloudWatch Alarms
├── Project/Task/User/Comment/Activity/Upload/Task-update Lambdas + routes
├── Health + Platform (suspension) Lambdas + routes
├── Stale-session sweeper + AI-summary scheduled jobs
└── Org.NestedStack (OrgNestedStack)
    ├── Signup, by-slug, accept-invite  (public)
    ├── Current-org, update-settings, invites, roles, pipelines, audit, transfer
    ├── Retention sweeper (nightly 03:00 UTC)
    └── Seat reconciliation (nightly 03:30 UTC)
└── Workflow.NestedStack (WorkflowNestedStack)
    ├── Attendance handlers (5)
    └── Day-off handlers (7)
└── Integrations.NestedStack (IntegrationsNestedStack — Session 9)
    ├── Connect/disconnect/list/get integration handlers
    ├── List providers (catalog from connector_registry)
    ├── Webhook router + dispatcher (HMAC-verified inbound)
    ├── Pusher + sync worker (outbound + reconciliation)
    └── Dedicated API Gateway domain — surfaced to frontend as
        NEXT_PUBLIC_INTEGRATIONS_API_URL so integration traffic
        doesn't share quota or rate-limit budget with the main API
```

### Why nested stacks
Parent was at 499/500 before the refactor. Moving context handlers into nested stacks gives each nested stack its own 500-resource budget. Stateful resources (Table, UserPool, bucket, CloudFront) **stay in parent** — moving them would trigger DELETE+CREATE under CloudFormation semantics.

### Cross-stack references
CDK generates CFN `Fn::ImportValue` / `Fn::GetAtt` automatically when you pass a parent-owned object (`api`, `table`, `user_pool`) into a nested-stack constructor. No manual wiring.

---

## 8. Frontend architecture

### App Router route groups
```
app/
├── (auth)/              # Unauth pages
│   ├── login/
│   ├── signup/
│   ├── invite/[token]/
│   └── verify-email/
└── (dashboard)/         # Authenticated pages
    ├── layout.tsx       # Auth gate + suspend gate + verify-email gate + sidebar
    ├── dashboard/
    ├── projects/
    ├── my-tasks/
    ├── reports/
    ├── attendance/
    ├── day-offs/
    ├── admin/users/
    └── settings/
        ├── organization/
        ├── roles/
        ├── pipelines/
        ├── plan/
        ├── audit/
        └── transfer-ownership/
```

### State management
- **TanStack React Query** for server state (stale-while-revalidate, 10s staleTime)
- **Context providers** for cross-cutting concerns: `AuthProvider`, `TenantProvider`, `ThemeProvider`, `ToastProvider`
- **Local state** (useState) for form + UI state

### Tenant provider
`TenantProvider` hydrates `current` from `GET /orgs/current` after login, applies CSS-variable theme (`applyTenantTheme`), and listens for the `taskflow:org-suspended` window event to refetch when a mid-session 403 fires.

### API client
Single `apiClient` wrapper around `fetch` at [frontend/src/lib/api/client.ts](frontend/src/lib/api/client.ts):
- Auto-attaches `Bearer` token from localStorage
- Transforms camelCase → snake_case on outbound, snake → camel on inbound
- Auto-redirects to `/login` on 401
- Dispatches window event on `ORG_SUSPENDED` error code
- Surfaces `code` field to callers via `ApiClientError`

---

## 9. Security model

| Layer | Implementation |
|---|---|
| Auth | Cognito SRP — password never leaves the browser |
| Token transport | Bearer in `Authorization` header; HTTPS enforced, TLS 1.3 minimum on desktop |
| Token storage (web) | `localStorage` (short ID-token TTL + refresh flow) |
| Token storage (desktop) | Windows DPAPI + Credential Manager |
| Role authority | DynamoDB is source of truth; JWT is advisory; re-read on every request |
| Permission check | `require()` fails closed (unknown role = empty permission set) |
| Cross-tenant isolation | ContextVar-scoped repos + moto-backed contract tests in CI |
| File uploads | S3 presigned URLs; presign handler refuses keys outside `orgs/{orgId}/` prefix |
| Secrets | AWS Secrets Manager (Gmail SMTP, Groq API key) |
| Signup abuse | WAFv2 per-IP signup rate-limit (5 / 5min) + optional hCaptcha |
| Suspension | Platform-operator env allowlist; fail-closed when unset |
| Email verification | Signup creates `email_verified=false`; frontend + defense-in-depth helper |
| Activity monitoring | Consent-gated; event counts only (no keystrokes); 5s screenshot warning |
| Day-off approval | Self-approval blocked at API layer |

---

## 10. Observability

### Logging
- Every Lambda writes to CloudWatch Logs
- Log retention: 3 months on staging, 1 year on prod (configured per nested stack)
- Parent-stack Lambdas use CloudWatch default (never-expire) — applying retention there emits Custom::LogRetention helper resources that would push past the 500-resource cap

### Alarms
Five CloudWatch alarms:
1. **Api5xxRate** — 5xx% > 5% over two 5-minute windows
2. **Api4xxSpike** — 4xx count > 500 (prod) in 5 minutes over 3 periods
3. **ApiLatencyP95** — p95 > 3s for 15 minutes
4. **DdbUserErrors** — > 50 ConditionalCheckFailed / 5 minutes (suggests broken invariant)
5. **DdbThrottles** — > 10 throttled requests / 5 minutes (hot partition)

SNS action not yet wired — alarms are visible in the console. When `config["ops_sns_topic_arn"]` is set, they'll page.

### Audit log
Every sensitive mutation (`role.updated`, `ownership.transferred`, `org.suspended`, `plan.upgraded`, etc.) writes to `PK=ORG#{org}#AUDIT` via `shared_kernel/audit.record()`. Best-effort — never breaks the primary action if the audit put fails. Reader endpoint is live; UI viewer page is backlog.

### Sentry
Scaffolded but dormant. Activates when `SENTRY_DSN` env var is set + `sentry-sdk[aws_lambda]` is in the Lambda deps layer (backend) or `@sentry/browser` is installed (frontend). No-op otherwise.

### Health check
`GET /health` — unauthed, DDB `describe_table` reachability probe. Returns 200 on success, 503 on DDB failure.

---

## 10a. Notifications (Session 5)

Per-user partition on the existing USER tree so a single query can bulk-fetch:

```
PK = ORG#{org_id}#USER#{user_id}
SK = NOTIF#{iso_timestamp}#{notif_id}
```

Writer: `shared_kernel.notifications.create(org, user, type, title, message, link, metadata)` — fire-and-forget, never raises. Emitters call it from handlers after successful actions (e.g. `assign_task.py` after the use case succeeds).

Reader: `list_for_user(org, user, limit, unread_only)` via `ScanIndexForward=False` → newest first; unread filter is client-side because volumes are small.

Mark-read: stamps `read_at` via UpdateItem (single-item) or a bounded scan + batch update (mark-all-read, capped at 200 items per call).

API surface is a single router Lambda — `GET` lists, `POST` with action body (`{action: "mark_read", notif_id}` or `{action: "mark_all_read"}`) dispatches. Chose shallow routing over separate `/read` + `/read-all` subpaths to conserve CFN method count.

Frontend merges server-side notifications with the existing client-derived ones (overdue tasks, timer-too-long) in `NotificationCenter.tsx`. Polls every 30s + on panel open.

## 10b. Outbound webhooks (Session 5)

Per-org subscriptions on the org partition:

```
PK = ORG#{org_id}
SK = WEBHOOK#{webhook_id}
```

Attributes: `url`, `secret` (stored plaintext — needed to re-sign on every delivery), `events[]`, `enabled`, `description`, timestamps.

### Signature
```
X-TaskFlow-Signature: t={unix_seconds},v1={hmac_hex}
hmac_hex = HMAC_SHA256(secret, "{t}.{body_bytes}")
```

Same shape as Stripe's webhook signing, so subscribers' Stripe-webhook libraries port with minimal tweaks.

### Delivery
Synchronous from the emitter (`webhooks.deliver(org, event, payload)`) with a 5-second per-URL timeout. 2xx = success; any other response or network failure is logged and dropped. First wiring: `task.assigned` (from `assign_task.py`). Future emitters will call `deliver()` the same way.

No retry queue in v1 — subscribers must tolerate missed deliveries and reconcile via API. Adding SQS + retry with exponential backoff is straightforward when a real tenant needs stronger guarantees.

### CRUD router
Single Lambda at `/orgs/current/webhooks{,/{webhookId}}` with ANY verb dispatch (same pattern as roles_router / pipelines_router). Secret is returned in full only on the create response; subsequent reads mask it (`abc…xyz` preview).

## 10c. Platform operator console (Sessions 1, 5, 7)

Operator-only endpoints scoped under `/platform`:

| Route | Method | Purpose |
|---|---|---|
| `/platform/orgs/{orgId}/status` | POST | Suspend / resume tenant |
| `/platform/orgs/{orgId}/features` | PATCH | Shallow-merge `OrgSettings.features` |

Both gated by env-allowlist `PLATFORM_ADMIN_USER_IDS` (comma-separated Cognito subs). Fail-closed when unset.

Frontend console at `/platform` uses `NEXT_PUBLIC_PLATFORM_ADMIN_USER_IDS` (must mirror backend env) for UX-level gating. Non-admins get redirected to `/dashboard`; backend is the real authority.

Tenant lookup: the operator types a workspace slug; frontend hits the public `GET /orgs/by-slug/{slug}` endpoint to resolve + display the orgId. No global "list all tenants" endpoint exists — deliberately, to keep the footprint small.

## 10d. Deletion lifecycle (Session 2)

Three-state status on `Organization`: `ACTIVE | SUSPENDED | PENDING_DELETION`. Plus a nullable `deleted_at` timestamp. The `require_not_suspended()` helper now treats both `SUSPENDED` and `PENDING_DELETION` as read-only, with typed error codes `ORG_SUSPENDED` and `ORG_PENDING_DELETION` so the frontend can render different UIs.

### Lifecycle endpoints (OWNER + email-verified)
| Route | Method | Effect |
|---|---|---|
| `/orgs/current/delete` | POST | Typed-slug confirm; marks `PENDING_DELETION`, stamps `deleted_at` |
| `/orgs/current/undelete` | POST | Clears `deleted_at`, back to `ACTIVE` (grace window only) |
| `/orgs/current/export` | POST | Dumps all tenant-scoped DDB items to `orgs/{orgId}/exports/{ts}.json` on S3, returns 24h presigned GET URL |

### Hard-delete sweeper
Scheduled Lambda at 04:00 UTC (after retention sweeper + seat reconciliation). Scans `list_all_orgs()`, filters to `PENDING_DELETION AND deleted_at < now-30d`, then for each match:
1. Collect Cognito user emails from the DDB USER records (needed before we delete them)
2. Batch-delete every item with PK `ORG#{org_id}#*` (USER/PROJECT/etc. composite partitions)
3. Batch-delete the ORG partition (ORG, SETTINGS, PLAN, ROLE#*, PIPELINE#*, INVITE#*, WEBHOOK#*)
4. Batch-delete the AUDIT partition
5. Delete the SLUG resolver (makes the slug available for reclaim)
6. `admin_delete_user` every Cognito user email

`HARD_DELETE_GRACE_DAYS` env lets staging rehearse with a compressed timeline.

Frontend `/settings/delete-workspace` wires all three surfaces: export (always available), delete (typed-slug confirm, hidden once pending), recover (only visible during grace). Dashboard layout grows a `PendingDeletionBanner` showing days-remaining to every org user.

## 10e. Integrations platform (Session 9)

Pluggable 3rd-party connector framework. Lives in `backend/src/contexts/integrations/` as its own bounded context with the four-layer DDD split.

### Connector protocol
[backend/src/contexts/integrations/domain/connector_protocol.py](backend/src/contexts/integrations/domain/connector_protocol.py) defines the runtime-checkable Protocol every connector must satisfy: `provider_id`, `display_name`, `connect_form_schema()`, `validate_credentials()`, `parse_inbound_webhook()`, `verify_inbound_signature()`, `outbound_emit()`. The `connector_registry.py` in the same package is the lookup table — each connector self-registers via `bootstrap.py` import side-effects.

A contract test (`test_connector_protocol_compliance.py`) iterates the registry and asserts every entry implements the Protocol — adding a connector that forgets a method fails CI before it ships.

### Per-provider isolation
Each connector lives under `connectors/{provider}/` with its own client modules, field map, parser, and connector class. **`test_no_inbound_imports.py`** enforces that domain/application code never imports from a specific connectors namespace — connectors are plugins, not first-class siblings. **`test_provider_namespace_isolation.py`** asserts a Freshdesk webhook can't write into a Freshservice integration's data.

### Freshworks connector (first shipping)
Covers Freshdesk + Freshservice via shared REST + webhook patterns:

- `freshdesk_client.py` / `freshservice_client.py` — thin REST wrappers (auth, pagination, retry semantics)
- `webhook_parser.py` — normalises inbound payloads into `NormalizedTaskEvent` (HMAC-verified before parsing)
- `field_map.py` — declarative mapping from external ticket fields (subject, status, priority, requester, etc.) into TaskFlow task attributes; unit-tested per direction
- `connector.py` — orchestrates the protocol methods

### Inbound flow
`POST /webhooks/{provider}` (no auth — protected by HMAC signature):
1. `webhook_router.py` resolves the provider by URL segment
2. `webhook_dispatch.py` looks up the integration record by `external_workspace_id`, verifies the signature against the stored secret
3. Parsed event hits `upsert_task_from_external` — idempotent on `(integration_id, external_id)`. Updates an existing TaskFlow task or creates a new one with the configured assignee resolution rules.

### Outbound flow
TaskFlow domain events emit via `shared_kernel/integration_emitter.py` (fire-and-forget — never raises, never blocks). The `pusher.py` Lambda picks events out of the outbox and pushes them to the connector's `outbound_emit()` method. `sync_worker.py` handles reconciliation backfills. **Test contract**: `test_emitter_swallows_all_errors.py` asserts a misbehaving connector can never break the host action.

### Storage
- `IntegrationRecord` at `PK=ORG#{org}#INTEGRATION#{integrationId}` — credentials stored encrypted via KMS (`infrastructure/kms_credentials.py`)
- `ExternalLink` at `PK=ORG#{org}#EXT#{provider}#{externalId}` — `(integration, externalId) → (taskflowTaskId)` mapping
- `OutboxEvent` at `PK=ORG#{org}#OUTBOX` — pending outbound deliveries
- `SyncEvent` audit trail at `PK=ORG#{org}#SYNCEVT`

### Plan gating
Pulled through the new `integrations/application/plan_gate.py` use case — PRO-tier minimum. Calls `require_feature(auth, "integrations")` so a FREE tenant gets `PLAN_FEATURE_LOCKED` before any connector code runs.

### Frontend surface
`/settings/integrations` — provider browse page, dynamic connect form (per-connector schema), per-integration detail page with disconnect, Freshdesk webhook setup guide with copy-to-clipboard helpers. Hits a separate API origin set by `NEXT_PUBLIC_INTEGRATIONS_API_URL` (configured from the `IntegrationsNestedStack`'s API Gateway URL output).

---

## 11. Scheduled jobs

| Job | Schedule (UTC) | Purpose |
|---|---|---|
| Daily AI summary generation | 18:00 | Groq-generated per-user productivity summary for previous day |
| Retention sweeper | 03:00 | Delete ACTIVITY rows older than `plan.retention_days` per-org |
| Seat reconciliation | 03:30 | Detect seat overflow post-race; audit via "system:reconciliation" actor |
| Hard-delete sweeper | 04:00 | Purge tenants past 30-day `deleted_at` grace (see §10d) |
| Stale session sweeper | every 5 min | Close abandoned desktop attendance sessions |

---

## 12. Testing

### Backend
- **pytest** (`backend/pytest.ini`, testpaths=tests, pythonpath=src)
- Domain unit tests (User, Task, Pipeline entities)
- Attendance sweep use-case tests with fake repos
- **Composite activity score tests** ([backend/tests/test_domain_activity.py](backend/tests/test_domain_activity.py)) — 11 tests pinning formula behaviour: empty day, full-presence, wiggle-farmer punishment, power-typist cap, keyboard-vs-mouse weighting, breakdown serialization
- **Multitenancy contract tests** ([backend/tests/test_multitenancy.py](backend/tests/test_multitenancy.py)) — moto-backed DynamoDB, two orgs in one table, assert cross-tenant reads return None/empty
- **Integrations contract tests** ([backend/tests/integrations/](backend/tests/integrations/)) — 8 tests added in Session 9: connector protocol compliance, namespace isolation between providers, no-inbound-imports enforcement, emitter error swallowing, Freshworks field map (per-direction), inbound flow, outbound flow, webhook parser, signature verification
- Current count: 52 tests across 6 test files, passing

### Frontend
- No test harness yet. Backlog — add Vitest / React Testing Library when a feature regression forces it.
- `npm run lint` now runs `tsc --noEmit` (Session 9): Next.js 16 dropped `next lint`, the repo never had an ESLint config installed, so the typechecker is the CI gate. Same intent — catches broken code before merge.

### CI
- **backend-ci.yml** — pytest on push/PR to `main` / `saas-migration` (path-filtered to `backend/**`)
- **frontend-ci.yml** — typecheck + production build on push/PR (path-filtered to `frontend/**`)
- **integrations-additivity.yml** (Session 9) — enforces the "integrations contracts can only grow, never shrink" invariant. Stops a PR from accidentally removing a connector field or event type that external installations depend on.
- All three cancel in-progress runs on new pushes to the same branch.

---

## 13. Deployment & cutover

### Current deploy commands (post-V2 cutover, Session 9)
```bash
# Staging V2 (active dev target)
cd backend/cdk && cdk deploy --app "python app_staging.py" --profile company

# Production V2 (post-staging-verify target)
cd backend/cdk && cdk deploy --app "python app_company_v2.py" --profile company

# Production (legacy — DO NOT TOUCH without explicit cutover authorization)
cd backend/cdk && cdk deploy --app "python app_company.py" --profile company
```

### Vercel front-end
Staging Vercel project: `taskflow-ns.vercel.app`. CORS allowlist on the V2 staging stack now includes this URL alongside `localhost:3000`. The Vercel env vars (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_INTEGRATIONS_API_URL`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`) come from the CDK stack outputs (parent + `IntegrationsNestedStack`).

### Legacy-prod cutover rehearsal (outstanding)
1. Snapshot prod DynamoDB
2. Run `backfill_neurostack.py --dry-run` against snapshot
3. Inspect item counts, spot-check 10 items
4. Run real backfill during maintenance window
5. Deploy CDK to legacy `taskflow` stack
6. Flip Vercel env vars to point at legacy prod API
7. Monitor for 24h before closing the cutover ticket

### Rollback
- DynamoDB PITR gives 35-day point-in-time recovery on prod
- CDK stack rollback via CloudFormation UpdateStack revert
- Vercel: redeploy previous commit
- For stuck attendance sessions after a bad seed/script: `python backend/scripts/force_signout_all.py --org-id {org} --confirm`

---

## 14. Known gaps & deferred work

See [docs/saas/SAAS-STATUS.md](docs/saas/SAAS-STATUS.md) for the full living status. Highlights:

| Category | Gap | Why deferred |
|---|---|---|
| Platform | API custom domain (`api.taskflow.neurostack.in`) | Purely cosmetic under Option B; revisit for 3rd-party API consumers |
| Migration | Prod backfill rehearsal | Awaiting your go-ahead |
| Email | SES migration from Gmail SMTP | Gmail works at current scale (~500/day cap) |
| Webhooks | Retry queue + dead-letter | Synchronous best-effort is enough for current tenant count; add SQS when a tenant needs guarantees |
| Notifications | Additional emitters (dayoff, invite, mention) | First emitter (task.assigned) is the proof-point; add more as use cases surface |
| i18n | Full call-site migration | Foundation + 2 migrations shipped; ~35 sites still use `toLocaleDateString('en-US')`. Incremental. |
| Desktop | macOS build + code-signing + first-run UI | Separate repo; needs Mac host + CA certs + focused session |
| Billing | Stripe integration | Plan tier set manually today |
| SSO | SAML / OIDC federation | Waiting on enterprise prospect |
| Plan gating | `custom_roles`, `custom_pipelines`, `audit_logs`, `api_access`, `sso`, `white_label`, `custom_domain` still declared-but-not-enforced | The gate-mechanism question is solved (Session 9 made `require_feature()` plan-aware); each remaining flag now needs the per-feature wiring at the right call sites. Design in [docs/architecture/PLAN-LIMITS.md](docs/architecture/PLAN-LIMITS.md) |
| Audit retention | Sweeper extends to `EVENT#` rows | Today only `ACTIVITY#` rows are pruned; audit events accumulate forever, making the per-tier retention claim partially aspirational |
| Integrations | Webhook retry queue + dead-letter; additional connectors (Slack, GitHub, Jira, Google Calendar) | Freshworks is the proof-point; add more once a paying tenant requests one. Slack design draft at [docs/planning/SLACK-CONNECTOR-PLAN.md](docs/planning/SLACK-CONNECTOR-PLAN.md). |

---

## 15. Further reading

- [docs/saas/SAAS-MIGRATION.md](docs/saas/SAAS-MIGRATION.md) — original phased plan for multi-tenant conversion
- [docs/saas/SAAS-PROGRESS.md](docs/saas/SAAS-PROGRESS.md) — running log of what each phase shipped
- [docs/saas/SAAS-STATUS.md](docs/saas/SAAS-STATUS.md) — current state against the P0/P1/P2 roadmap
- [docs/architecture/RBAC-DOCUMENTATION.md](docs/architecture/RBAC-DOCUMENTATION.md) — system roles vs. project roles, permission matrix
- [docs/architecture/TIMER-ARCHITECTURE.md](docs/architecture/TIMER-ARCHITECTURE.md) — timer state machine across web + desktop
- [docs/architecture/PLAN-LIMITS.md](docs/architecture/PLAN-LIMITS.md) — plan tiers, capacity caps, feature gating
- [docs/api/API.md](docs/api/API.md) — endpoint reference
- [CLAUDE.md](CLAUDE.md) — the authoritative codebase conventions file
