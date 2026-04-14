# TaskFlow → Multi-Tenant SaaS Conversion Plan

## Context

TaskFlow was built as an internal tool for NEUROSTACK: a serverless task-management platform with projects, tasks, attendance/timer, day-off requests, activity monitoring, birthday wishes, and a Go+Wails desktop companion app. Almost everything — the company name, branding, email domain, task pipelines (DEVELOPMENT/DESIGNING/MANAGEMENT/RESEARCH), roles (OWNER/ADMIN/MEMBER), employee-ID prefix (`EMP-`), CORS origins, region — is hardcoded or implicitly scoped to one company.

The goal is to convert it into a **multi-tenant SaaS** where any company can sign up and customize roles, terminology, workflows, branding, features, and limits, while their data stays completely isolated from other tenants. Every customization must ship with a sensible default so an org works out of the box without touching settings.

**Locked-in architectural decisions:**
- **Isolation model:** pooled — one DynamoDB table, one Cognito user pool, one S3 bucket, with `org_id` prefixed into every key
- **Routing:** single domain `taskflow.neurostack.in` with a workspace-code field on the login form; per-tenant subdomains deferred as a future Pro-tier feature
- **Existing data:** backfill all NEUROSTACK data as the first tenant (`org_id = "neurostack"`), zero downtime
- **Billing:** plan limits (Free/Pro/Enterprise) enforced in code; Stripe deferred

---

## Cross-cutting design

### Tenant identity propagation
- Canonical `org_id` lives on the Cognito user as immutable `custom:orgId`.
- A **Cognito pre-token-generation Lambda trigger** injects `custom:orgId`, `custom:roleId`, `custom:systemRole` into every ID token so backend handlers get them without a DB round-trip.
- [backend/src/shared_kernel/auth_context.py](backend/src/shared_kernel/auth_context.py) gains `org_id: str` on `AuthContext`; every handler already calls `extract_auth_context(event)` so no handler changes are needed except where DynamoDB keys are built.

### DynamoDB key schema
Single table retained. Every non-global item prefixed with `ORG#{orgId}#`:

```
PK=ORG#{org}#USER#{userId}            SK=PROFILE
PK=ORG#{org}#PROJECT#{projectId}      SK=META | TASK#{taskId} | MEMBER#{userId}
PK=ORG#{org}                          SK=ORG | SETTINGS | PLAN
PK=ORG#{org}                          SK=ROLE#{roleId} | PIPELINE#{id} | INVITE#{token}
PK=SLUG#{slug}                        SK=ORG       # workspace-code → org_id resolver
GSI1PK=EMAIL#{email}                               # email globally unique (Cognito alias)
GSI2PK=ORG#{org}#EMPLOYEE#{employeeId}             # employee IDs scoped per-tenant
```

A new helper module [backend/src/shared_kernel/tenant_keys.py](backend/src/shared_kernel/tenant_keys.py) centralizes key construction so the 8 context repositories never string-format PKs inline.

### S3 key prefixing
All uploads keyed `orgs/{orgId}/{userId}/{filename}`. The presign handler pulls `orgId` from `AuthContext` and refuses any key outside the tenant's prefix — enforced at presign time, not just via bucket policy.

### Cognito login (email + password, workspace code for branding)
The frontend is served from a single domain `taskflow.neurostack.in`. The login form has three fields: **workspace code**, email, password. When the user types the workspace code the frontend calls public `GET /orgs/by-slug/{slug}` → fetches org metadata (display name, logo, primary color, Cognito client config) and caches it in `localStorage.workspace` so returning users don't retype it. The workspace code exists only to theme the login screen and validate the user lands in the right org — it is **not** part of the login credential. Cognito authenticates via **globally unique email + password** using the standard Cognito alias flow. The shared pool enforces email uniqueness across every tenant, so a given email belongs to exactly one org. After login, the frontend verifies the JWT's `custom:orgId` matches the entered workspace code and shows an error like "This email belongs to a different workspace" if they mismatch. A "Switch workspace" menu item clears the cached workspace and returns the user to the workspace-code prompt.

---

## Phase 1 — Multi-tenant foundation (minimum shippable)

**Goal:** Two orgs coexist in one DB/Cognito/S3. NEUROSTACK data migrated. Defaults only — no customization UI yet.

### Backend
- **New bounded context** `backend/src/contexts/org/`
  - `domain/entities.py` — `Organization`, `OrgSettings`, `Invite`, `Plan`
  - `application/create_organization.py`, `application/get_current_org.py`
  - `infrastructure/dynamo_repository.py` using new `ORG#` keys
  - `handlers/signup_org.py` (public `POST /signup`), `handlers/get_org_by_slug.py` (public `GET /orgs/by-slug/{slug}`), `handlers/get_current_org.py`
- **Modify** [backend/src/shared_kernel/auth_context.py](backend/src/shared_kernel/auth_context.py): add `org_id` field, read from JWT `custom:orgId`
- **New** [backend/src/shared_kernel/tenant_keys.py](backend/src/shared_kernel/tenant_keys.py): `user_pk(org, uid)`, `project_pk(org, pid)`, etc.
- **Update** 8 context repositories in `backend/src/contexts/*/infrastructure/dynamo_repository.py` — accept `org_id` in constructor, route all PK construction through `tenant_keys`
- **Update** [backend/src/contexts/user/infrastructure/dynamo_repository.py](backend/src/contexts/user/infrastructure/dynamo_repository.py): `_generate_employee_id` reads `settings.employee_id_prefix` instead of hardcoding `EMP-`. The `company_prefix` field already on `User` (currently unused) finally gets wired up.
- **Update** [backend/cdk/stack.py](backend/cdk/stack.py):
  - Add `"orgId"` as Cognito `StringAttribute(mutable=False)` in `custom_attributes`
  - Add pre-token-generation Lambda trigger
  - Replace hardcoded `cors_origins` list with the literals `['https://taskflow.neurostack.in', 'http://localhost:3000']`, validated against the request `Origin` header in the Lambda response
  - Add `POST /signup` route with `AuthorizationType.NONE`

### Frontend
- **New** `frontend/src/providers/TenantProvider.tsx` — reads workspace code from `localStorage.workspace` / `?workspace=` query param / login form, fetches `GET /orgs/by-slug/{slug}`, configures Amplify, exposes `TenantContext`. No host-parsing middleware needed — single domain only.
- **New** `frontend/src/components/WorkspaceField.tsx` — reusable workspace-code input with debounced availability check; used on login and signup
- **New** `frontend/src/app/login/page.tsx` — three-field form (workspace code, email, password); pre-fills workspace from `?workspace=` query or `localStorage`, sends user to the workspace-code prompt if neither is set; post-login check that the JWT's `custom:orgId` matches the entered workspace code
- **New** `frontend/src/app/signup/page.tsx` — collects org name, slug (with availability check), owner email/password; on submit redirects to `https://taskflow.neurostack.in/login?workspace={slug}&first_login=1`
- **New** `frontend/src/lib/api/orgs.ts` — API client for org endpoints

### Infra
- Route53 records in the existing `neurostack.in` hosted zone: `taskflow.neurostack.in` → CloudFront (frontend) and `api.taskflow.neurostack.in` → API Gateway custom domain
- ACM cert for `taskflow.neurostack.in` in `us-east-1` (CloudFront requires it there) and a second cert in `ap-south-1` for the API Gateway custom domain. No wildcard cert needed.

### Backfill (zero-downtime cutover)
New script `backend/scripts/backfill_neurostack.py`:
1. Deploy code that **dual-writes** (old keys + new `ORG#neurostack#` keys)
2. Scan table → write new-format item for every old item → set `org_id="neurostack"` attribute
3. Insert `ORG#neurostack / ORG`, `SETTINGS`, `PLAN` records seeded with current NEUROSTACK branding/pipelines/roles
4. Cognito admin migration: `admin_update_user_attributes` setting `custom:orgId=neurostack` on every existing user
5. Deploy code that reads/writes only new format
6. Deletion sweep of old-format items

### Gotchas
- Two-phase signup failure: if Cognito `admin_create_user` succeeds but the DynamoDB `TransactWriteItems` for org+settings+first-user fails, you orphan a Cognito user. Wrap in try/except with rollback calling `admin_delete_user`.
- Hot partition: org-prefixing does not create one hot PK because existing PKs were already user/project-scoped. Audit for any aggregate keys like `ORG#{id}#USER#LIST` and avoid them — always query scoped PKs.

**Exit gate:** NEUROSTACK users log in at `taskflow.neurostack.in` with workspace code `neurostack` and see everything as before; a fresh org signs up with workspace code `acme` and sees zero NEUROSTACK data.

---

## Phase 2 — Invites & tenant user management

**Goal:** OWNER of an org invites additional users scoped to their org.

- New `backend/src/contexts/org/handlers/send_invite.py`: writes `SK=INVITE#{token}` with 7-day TTL; reuses the existing Gmail SMTP pattern (Gmail credentials live in Secrets Manager as `taskflow/gmail-credentials`)
- New `backend/src/contexts/org/handlers/accept_invite.py`: public endpoint; validates token; `admin_create_user` with `custom:orgId` from the invite
- Update [backend/src/contexts/user/handlers/create_user.py](backend/src/contexts/user/handlers/create_user.py): `org_id` is always from `AuthContext`, never from the request body — admins can only create users in their own org
- Plan-limit check: refuse create if `user_count >= plan.max_users`
- Frontend `/invite/[token]` page: collects name + password, accepts invite, redirects to `https://taskflow.neurostack.in/login?workspace={slug}` with the workspace code pre-filled

**Email uniqueness — kept globally unique (standard SaaS pattern):** Email stays as the Cognito login alias exactly as it is today. Uniqueness is enforced globally across every tenant — a given email cannot exist in two orgs. Signup and invite handlers catch Cognito's `AliasExistsException` and return `409 email_taken`. This matches how every major SaaS works (Slack, Linear, Notion, GitHub). Consultants who need the same email in two orgs use a `+suffix` alias or a different address.

**Exit gate:** Two orgs, each with 3 invited users, log in and see only their own data.

---

## Phase 3 — Tenant configuration model (branding, terminology, features)

**Goal:** `OrgSettings` becomes real and editable; frontend reads it; terminology and colors change per tenant.

### OrgSettings shape (seeded with sensible defaults)
```python
class OrgSettings(BaseModel):
    org_id: str
    # Branding
    display_name: str
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = "#4F46E5"
    accent_color: str = "#10B981"
    # Terminology overrides (i18n)
    terminology: dict[str, str] = {}   # {"employee": "Associate", "project": "Engagement", ...}
    # Locale
    timezone: str = "Asia/Kolkata"
    locale: str = "en-IN"
    currency: str = "INR"
    week_start_day: int = 1
    working_hours_start: str = "09:00"
    working_hours_end: str = "18:00"
    # Identity
    employee_id_prefix: str = "EMP-"
    # Feature toggles
    features: dict[str, bool] = {
        "birthday_wishes": True,
        "activity_monitoring": True,
        "screenshots": False,
        "ai_summaries": True,
        "day_offs": True,
        "comments": True,
        "task_updates": True,
    }
    # Leave types
    leave_types: list[dict] = [
        {"id": "casual", "name": "Casual", "annual_quota": 12},
        {"id": "sick",   "name": "Sick",   "annual_quota": 10},
        {"id": "earned", "name": "Earned", "annual_quota": 15},
    ]
```

Stored as a single JSON item at `PK=ORG#{id} SK=SETTINGS`. Seeded at org creation so any new tenant works without touching settings.

### Backend handlers
- `GET /orgs/current/settings` — returns settings JSON
- `PUT /orgs/current/settings` — OWNER only, merged + validated
- `POST /orgs/current/logo` — presigned URL scoped to `orgs/{orgId}/branding/`

### Frontend
- **New** `frontend/src/lib/i18n.ts` — base JSON strings merged with `settings.terminology` at runtime; `t("task.singular")` returns `"Ticket"` or `"Task"` depending on org override
- **Migration:** replace hardcoded labels (`"Employee ID"`, `"Task"`, `"Project"`, etc.) across `frontend/src/app/(dashboard)/**` with `t()` calls — estimated 40–60 replacements, found via grep
- **Theming:** update `frontend/tailwind.config.ts` to map `primary`/`accent` to CSS variables (`rgb(var(--color-primary) / <alpha-value>)`); `TenantProvider` injects a `<style>` tag at root from `settings.primary_color`. Existing `bg-blue-600`-style classes get migrated to `bg-primary`.
- **Feature gates:** `<FeatureGate feature="birthday_wishes">` wrapper; sidebar entries hide when disabled; backend handlers also return 404 if the feature is off (defense in depth)
- **New** `frontend/src/app/(dashboard)/settings/organization/page.tsx` with tabs: Branding, Terminology, Locale, Features, Leave Types

**Exit gate:** Two orgs with different names, colors, logos, and terminology visible simultaneously in different browser tabs.

---

## Phase 4 — Custom roles & permission matrix

**Goal:** Replace the hardcoded `SystemRole` (OWNER/ADMIN/MEMBER) and `ProjectRole` (ADMIN/PROJECT_MANAGER/TEAM_LEAD/MEMBER) enums with tenant-defined roles backed by a permission matrix.

### Domain
- **New** `backend/src/contexts/org/domain/role.py`: `Role(role_id, org_id, name, scope, is_system, permissions: set[str])`
- **New** `backend/src/contexts/org/domain/permissions.py`: ~30 string constants covering every handler: `task.create`, `task.delete`, `task.update.own`, `task.update.any`, `project.create`, `project.delete`, `user.invite`, `user.delete`, `settings.edit`, `billing.view`, `attendance.report.view`, `dayoff.approve`, `activity.view`, `role.manage`, etc.
- **New** `backend/src/contexts/org/domain/default_roles.py`: OWNER = all permissions (system, undeletable); ADMIN = all except `settings.edit` + `billing.*`; MEMBER = view/own-update subset. Inserted at org creation.
- **New** [backend/src/shared_kernel/permissions.py](backend/src/shared_kernel/permissions.py): `require(ctx, "task.delete")` helper replaces every `if ctx.system_role not in PRIVILEGED_ROLES` call site (grep `PRIVILEGED_ROLES` — ~15–25 call sites)
- **Keep** the existing [SystemRole enum](backend/src/contexts/user/domain/value_objects.py) as default role IDs for backward compatibility; `User.system_role` renames to `role_id` with a property mapping back to the enum for any un-migrated callers
- **ProjectRole** — becomes per-org role records with `scope="project"` and project-specific permissions (`project.edit`, `project.members.manage`, `task.assign.any`)

### Frontend
- `/settings/roles` admin page: list, create, clone, delete (except system roles); checkbox-grid permission matrix editor
- User-assign and project-member dropdowns become dynamic from `GET /orgs/current/roles`

### Gotcha
The pre-token-generation trigger must now inject `custom:roleId`. If a user's role changes mid-session, their ID token is stale for up to 1 hour (default Cognito ID token TTL). Add an Amplify `refreshSession()` call whenever the roles settings page is saved, and on any 403 response from the backend.

**Exit gate:** Org A defines a "Tester" role with only `task.view` + `task.update.status`. A user with that role cannot create tasks and cannot see settings.

---

## Phase 5 — Custom task pipelines & leave types

**Goal:** Replace hardcoded domain/pipeline config in [frontend/src/types/task.ts](frontend/src/types/task.ts) with tenant-defined pipelines.

- **New** `backend/src/contexts/org/domain/pipeline.py`: `Pipeline(pipeline_id, org_id, name, statuses: list[PipelineStatus])`, `PipelineStatus(id, label, color, order, is_terminal)`
- **Seeded defaults:** every new org gets DEVELOPMENT/DESIGNING/MANAGEMENT/RESEARCH pipelines with the current hardcoded statuses, so the existing experience is preserved
- **Update** [backend/src/contexts/task/domain/entities.py](backend/src/contexts/task/domain/entities.py): `domain` field becomes `pipeline_id`; `status` becomes a free-form string validated at write time against the pipeline's declared statuses
- **Update** [frontend/src/types/task.ts](frontend/src/types/task.ts): delete `DOMAIN_STATUSES`, `DOMAIN_LABELS`, `TASK_STATUS_LABEL`, `TASK_STATUS_COLORS`, `getStatusProgress`. Replace with `useTenantPipelines()` hook reading from `TenantContext`.
- **Kanban board** (`frontend/src/components/task/TaskKanban.tsx`) — columns derived from selected pipeline
- **New** `/settings/pipelines` admin page: create pipeline, add statuses, drag-reorder, pick colors
- **Leave types:** already modeled in `OrgSettings.leave_types`. Update `backend/src/contexts/dayoff/` to validate the `leave_type` field against the org's configured list.
- **Birthday feature** ([frontend/src/app/(dashboard)/birthdays/page.tsx](frontend/src/app/%28dashboard%29/birthdays/page.tsx)): remove the Giridharan mock data; gate the whole route behind `features.birthday_wishes`; reads real user list scoped to `org_id` from the existing `/users/birthdays` endpoint

### Gotcha
Existing NEUROSTACK tasks have `domain="DEVELOPMENT"` strings. Backfill creates a pipeline for org `neurostack` with `pipeline_id="DEVELOPMENT"` (same string) so existing task rows need no migration.

**Exit gate:** Org B creates a "Sales" pipeline with LEAD → QUALIFIED → CLOSED. Tasks in Org B show those columns; Org A's DEVELOPMENT pipeline is unaffected.

---

## Phase 6 — Desktop multi-tenancy, plan limits, rate limiting

### Desktop app
Currently [desktop/internal/config/config.go](desktop/internal/config/config.go) bakes `API_URL` + `APP_NAME` via `-ldflags`. Going multi-tenant:

1. Keep only `API_URL` baked in (single shared API = `https://api.taskflow.neurostack.in`).
2. On first launch, prompt **"Enter your workspace code"** (e.g. `acme`); save to `~/.taskflow/workspace.json`.
3. Subsequent launches read saved workspace. Add "Switch workspace" system-tray menu item that clears the saved code and reopens the prompt.
4. Login flow: `GET /orgs/by-slug/{workspace}` → Cognito SRP against shared pool → tokens contain `custom:orgId`.
5. Activity loop reads `features.screenshots` from the settings response; skips the screenshot goroutine entirely when disabled.

**Rejected alternative:** post-login org discovery via a global "which orgs does this email belong to" lookup — contradicts the Phase 2 decision to allow the same email across orgs.

### Plan limits
- **New** `backend/src/contexts/org/domain/plans.py`:
  ```python
  FREE = Plan(tier="free", max_users=10, max_projects=3, retention_days=30, features_allowed={...})
  PRO  = Plan(tier="pro",  max_users=50, max_projects=50, retention_days=365, features_allowed={...})
  ENTERPRISE = Plan(tier="enterprise", max_users=None, max_projects=None, retention_days=None, features_allowed={...all})
  ```
- Enforce in every create handler: `if current_count >= plan.max: raise PlanLimitExceeded()`
- **Retention sweeper:** new nightly scheduled Lambda that deletes activity heartbeats older than `org.plan.retention_days` (scoped per org)

### Rate limiting
- WAF rate-based rule keyed on the `x-workspace-code` request header the frontend sets after the workspace is resolved. Simpler than per-tenant API keys.

### Final CDK updates — [backend/cdk/stack.py](backend/cdk/stack.py)
- ACM cert for `taskflow.neurostack.in` in `us-east-1` (CloudFront) and `ap-south-1` (API Gateway custom domain) — no wildcard
- Route53 records in the existing `neurostack.in` zone
- Pre-token-generation Lambda trigger wired to the user pool
- `DEFAULT_CONFIG` / `STAGING_CONFIG` trimmed: `cors_origins` becomes the literal `['https://taskflow.neurostack.in', 'http://localhost:3000']`, keep `{stage, domain, table_name, user_pool_name}`
- `taskflow/gmail-credentials` secret reused by invite email sender

**Exit gate:** Same desktop binary connects to workspace codes `acme` and `neurostack` (two instances running side-by-side with separate config dirs). Free-plan org cannot create an 11th user.

---

## Phase summary

| Phase | Deliverable | Exit gate |
|-------|-------------|-----------|
| 1 | Org entity, key scoping, `auth_context.org_id`, signup, backfill, workspace-code login | Two orgs coexist, data fully isolated |
| 2 | Invite flow, per-tenant user creation | OWNER invites users only in their own org |
| 3 | `OrgSettings` — branding, terminology, locale, features | Two orgs show different logo/name/colors/labels simultaneously |
| 4 | Custom roles + permission matrix, `require()` helper | Tenant-defined role restricts actions correctly |
| 5 | Custom pipelines, leave types, birthday feature de-hardcoded | Org B uses a Sales pipeline; Org A's DEVELOPMENT unaffected |
| 6 | Desktop workspace prompt, plan limits, rate limiting, taskflow.neurostack.in cert | Desktop connects to any tenant; free plan blocks 11th user |

---

## Critical files (quick index)

**Backend:**
- [backend/cdk/stack.py](backend/cdk/stack.py) — infra, Cognito, CORS, signup route, taskflow.neurostack.in cert
- [backend/cdk/app.py](backend/cdk/app.py), [backend/cdk/app_staging.py](backend/cdk/app_staging.py) — entry points
- [backend/src/shared_kernel/auth_context.py](backend/src/shared_kernel/auth_context.py) — org_id injection point
- [backend/src/shared_kernel/tenant_keys.py](backend/src/shared_kernel/tenant_keys.py) — **new**, key builders
- [backend/src/shared_kernel/permissions.py](backend/src/shared_kernel/permissions.py) — **new**, `require()` helper
- [backend/src/contexts/org/](backend/src/contexts/org/) — **new bounded context**
- [backend/src/contexts/user/infrastructure/dynamo_repository.py](backend/src/contexts/user/infrastructure/dynamo_repository.py) — employee-ID prefix de-hardcoding
- [backend/src/contexts/user/domain/value_objects.py](backend/src/contexts/user/domain/value_objects.py) — `SystemRole` enum demoted to default role IDs
- [backend/src/contexts/project/domain/value_objects.py](backend/src/contexts/project/domain/value_objects.py) — `ProjectRole` likewise
- [backend/src/contexts/task/domain/entities.py](backend/src/contexts/task/domain/entities.py) — `domain` → `pipeline_id`
- `backend/scripts/backfill_neurostack.py` — **new**, one-time migration

**Frontend:**
- [frontend/src/types/task.ts](frontend/src/types/task.ts) — delete hardcoded pipelines
- `frontend/src/providers/TenantProvider.tsx` — **new**, tenant context (workspace code from localStorage / query / login form)
- `frontend/src/components/WorkspaceField.tsx` — **new**, workspace-code input with availability check
- `frontend/src/app/login/page.tsx` — **new**, three-field login (workspace code, email, password)
- `frontend/src/lib/i18n.ts` — **new**, terminology overrides
- [frontend/tailwind.config.ts](frontend/tailwind.config.ts) — CSS-variable theming
- `frontend/src/app/signup/page.tsx`, `frontend/src/app/invite/[token]/page.tsx` — **new**
- `frontend/src/app/(dashboard)/settings/organization/page.tsx`, `.../roles/page.tsx`, `.../pipelines/page.tsx` — **new**
- [frontend/src/app/(dashboard)/birthdays/page.tsx](frontend/src/app/%28dashboard%29/birthdays/page.tsx) — remove mock data, add feature gate

**Desktop:**
- [desktop/internal/config/config.go](desktop/internal/config/config.go) — strip tenant config, add workspace prompt
- `desktop/frontend/src/FirstRun.tsx` — **new**, workspace-code entry panel

---

## Verification strategy

Run per phase:

1. **Local two-org test** — open two browser profiles (or a normal + incognito window) at `http://localhost:3000`; enter workspace code `neurostack` in one and `acme` in the other. Both hit the same Next.js dev server; `TenantContext` is driven by `localStorage.workspace` per profile. No hosts file or DNS tricks needed.
2. **Backend isolation test** — new `backend/tests/test_multitenancy.py`: create two orgs, write a task in each, assert Org A's list endpoint never returns Org B's task even with a handcrafted JWT that points at Org B's data.
3. **Permission test** — token with `custom:orgId=A` attempting to read `PK=ORG#B#...` returns empty (verified at repository layer).
4. **Existing suite compatibility** — add a `with_org("neurostack")` fixture that stamps `org_id` into the auth context so the existing tests pass unchanged.
5. **Cutover dry run** — rehearse the backfill against a staging DB snapshot before running in prod; verify item count and that no item is skipped.
6. **End-to-end smoke test per phase** — create second org, invite user, change terminology to "Ticket", create pipeline, verify the first org is completely unaffected.

---

## Risks & non-obvious gotchas

- **Cognito user orphaning on signup failure** — wrap in try/except with `admin_delete_user` rollback
- **Email uniqueness enforced globally** — email stays as the Cognito login alias; signup and invite handlers must catch `AliasExistsException` and return `409 email_taken`. A given email cannot be reused across tenants. Frontend must validate post-login that the JWT's `custom:orgId` matches the workspace code the user entered, otherwise show a "wrong workspace" error.
- **Stale role in ID token** — after role change, force `Amplify.refreshSession()`; backend should return 403 (not 500) on permission denial so the frontend can retry after refresh
- **Hardcoded `PRIVILEGED_ROLES` checks** — ~15–25 sites to grep and replace with `require()` — easy to miss one
- **Hot partition aggregate keys** — audit for any `ORG#{id}#USER#LIST` patterns that could concentrate writes
- **CloudFront cert region** — the cert for `taskflow.neurostack.in` must be issued in `us-east-1` even though the API stack runs in `ap-south-1` → use a cross-region CDK stack for the CloudFront cert
- **Shared-domain cookie isolation** — all tenants share `taskflow.neurostack.in`, so browser cookies are not tenant-isolated at the origin level. Auth is JWT-in-localStorage, and the backend enforces `org_id` from the JWT on every request, so data isolation holds. Do not store any tenant-scoped data in cookies or the shared domain will leak it across tenants.
- **Backward-compat during cutover** — Phase 1 code must dual-write until the backfill finishes, then flip to new-format-only in a second deploy; never single-deploy the key change
- **Desktop ldflags regression** — do not bake `APP_NAME` anymore; use `display_name` from the settings fetch so the tray tooltip reflects the tenant
- **Backfill must also migrate Cognito** — `admin_update_user_attributes` on every existing user to set `custom:orgId=neurostack`; easy to forget because it's not in the DynamoDB script
