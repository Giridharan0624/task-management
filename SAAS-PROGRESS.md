# SaaS Migration — Full Progress

Branch `saas-migration` vs `main`: **231 files · +29,382 / −6,714 lines** across 17 commits.

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Multi-tenant foundation (org, keys, signup) | ✅ Shipped |
| 2 | Invites + tenant user management | ✅ Shipped |
| 3 | Tenant configuration (branding / settings) | ✅ Shipped |
| 4 | Custom roles + permission matrix | 🟨 Core shipped; ~10 use-case sites + Project roles pending |
| 5 | Custom task pipelines | 🟨 Foundation shipped; CRUD UI + frontend migration pending |
| 6 | Desktop + WAF rate limiting | 🟨 Screenshot gate + WAF shipped; first-run UI + signing pending |
| Prod rollout | Wildcard cert, Route53, stack splitting | ⏳ Not started |
| Billing | Stripe + plan enforcement | ⏳ Not started |

**Staging**: deployed and verified — stack `task-management-staging`, 494/500 resources, NEUROSTACK backfilled (role matrix + pipelines + `features.screenshots: true`).

**Prod**: untouched, live users, stays on current version until staging gate passes.

---

# Architecture — how org identification + isolation works

**Pooled isolation model**: one DynamoDB table, one Cognito user pool, one S3 bucket. Every non-global item keyed with `ORG#{orgId}#`. Two tenants coexist with zero data leakage because their PKs don't overlap.

## Request flow (browser → Lambda → DynamoDB)

```
┌──────────────────┐
│ acme.taskflow.com│  Subdomain → middleware extracts slug "acme"
└────────┬─────────┘
         │
         ▼  GET /orgs/by-slug/acme  (public, pre-auth)
┌──────────────────────────────┐
│ DynamoDB                     │
│   PK=SLUG#acme, SK=ORG       │  → { orgId, displayName, colors, logoUrl }
└──────────────────────────────┘
         │
         ▼  Frontend themes login screen, user enters credentials
┌──────────────────────────────┐
│ Cognito SRP                  │  User pool shared across all tenants
│   ├─ validates password      │  `custom:orgId` on user = authoritative
│   └─ pre-token Lambda fires  │  trigger: reads attrs, injects into claims
└──────────────────────────────┘
         │
         ▼  ID token with claims: sub, email, custom:orgId, custom:roleId
┌──────────────────────────────┐
│ API Gateway                  │  Cognito authorizer validates JWT
│   → Lambda handler           │
└──────────────────────────────┘
         │
         ▼  auth = extract_auth_context(event)
┌──────────────────────────────────────────────────────┐
│ shared_kernel/auth_context.py                        │
│   1. Read custom:orgId from JWT claims               │
│   2. Re-read system_role from DB (live role edits)   │
│   3. set_current_org_id(org_id)  ← ContextVar        │
└──────────────────────────────────────────────────────┘
         │
         ▼  Handler code
┌──────────────────────────────────────────────────────┐
│ require(auth, "task.delete.any")                     │  permissions.py
│   └─ lookup ROLE record + permission set             │  cached per-process
└──────────────────────────────────────────────────────┘
         │
         ▼  Repository instantiation
┌──────────────────────────────────────────────────────┐
│ TaskDynamoRepository()                               │
│   └─ reads org_id from ContextVar                    │
│   └─ uses tenant_keys.task_pk(org_id, task_id)       │
│      → "ORG#acme#PROJECT#p1#TASK#t1"                 │
└──────────────────────────────────────────────────────┘
         │
         ▼  Query
┌──────────────────────────────────────────────────────┐
│ DynamoDB — cross-tenant read structurally impossible │
│ because another org's PK literally doesn't exist     │
└──────────────────────────────────────────────────────┘
```

## DynamoDB key shape

```
Global (cross-tenant):
  PK=SLUG#{slug}              SK=ORG                   # slug → org resolver
  GSI1PK=USER_EMAIL#{email}                            # email uniqueness

Per-tenant (every item prefixed with ORG#):
  PK=ORG#{org}                SK=ORG                   # Organization
  PK=ORG#{org}                SK=SETTINGS              # Branding, features, locale
  PK=ORG#{org}                SK=PLAN                  # Tier + limits
  PK=ORG#{org}                SK=ROLE#{role_id}        # Role + permission set
  PK=ORG#{org}                SK=PIPELINE#{pipe_id}    # Task workflow
  PK=ORG#{org}                SK=INVITE#{token}        # Pending invite
  PK=ORG#{org}#USER#{uid}     SK=PROFILE               # User record
  PK=ORG#{org}#PROJECT#{pid}  SK=METADATA              # Project record
  PK=ORG#{org}#PROJECT#{pid}  SK=TASK#{tid}            # Tasks under project
  PK=ORG#{org}#PROJECT#{pid}  SK=MEMBER#{uid}          # Project members
  GSI2PK=ORG#{org}#EMPLOYEE#{eid}                      # Per-tenant employee ids
```

## Key files

| Concern | File |
|---|---|
| Slug → org resolver | [get_org_by_slug.py](backend/src/contexts/org/handlers/get_org_by_slug.py) |
| Cognito claim injection | [pre_token_trigger.py](backend/src/contexts/org/handlers/pre_token_trigger.py) |
| JWT → org_id extraction | [auth_context.py](backend/src/shared_kernel/auth_context.py) |
| PK/SK builders | [tenant_keys.py](backend/src/shared_kernel/tenant_keys.py) |
| Permission resolver | [permissions.py](backend/src/shared_kernel/permissions.py) |
| Signup transaction | [create_organization.py](backend/src/contexts/org/application/create_organization.py) |
| Frontend tenant context | [TenantProvider.tsx](frontend/src/lib/tenant/TenantProvider.tsx) |
| Desktop workspace storage | [workspace.go](desktop/internal/workspace/workspace.go) |

## Signup — the one moment that creates a tenant

```
POST /signup  { orgName, slug, ownerEmail, password }
  │
  ├─ Validate slug (3-30 chars, lowercase alnum + hyphens, not reserved)
  ├─ Check SLUG#{slug} doesn't exist
  ├─ Check email globally unique (USER_EMAIL#{email} GSI)
  │
  ├─ Cognito admin_create_user with custom:orgId=<new>, systemRole=OWNER
  │   └─ If later step fails → admin_delete_user (rollback)
  │
  └─ TransactWriteItems (all-or-nothing):
       ├─ ORG record
       ├─ SETTINGS record (defaults)
       ├─ PLAN record (FREE tier)
       ├─ ROLE owner/admin/member (default permissions)
       ├─ First USER record (the owner)
       ├─ SLUG resolver record
       └─ PIPELINE records (4 defaults)
```

## Failure modes — what keeps tenants isolated

1. **JWT spoofing**: a token issued to org A can't read org B because `custom:orgId` is signed by Cognito and the handler uses only the claim, never a request-body value.
2. **Cross-tenant handcrafted PK**: a handler that bypassed `tenant_keys` and built `ORG#B#...` manually — prevented because every repo constructor uses the ContextVar set by `extract_auth_context`.
3. **Public endpoints** (`POST /signup`, `GET /orgs/by-slug/{slug}`, `POST /invites/{token}/accept`): explicitly authenticate the operation differently. Signup is unauthenticated but rate-limited and creates a fresh org. `by-slug` is a narrow public read of safe branding fields only. Accept-invite trusts the token (random 256-bit secret) and runs a conditional write.
4. **S3**: presign handler refuses any key that doesn't start with `orgs/{orgId}/{userId}/...` — enforced at presign time, not only via bucket policy.

---

## Phase 1 — Multi-tenant foundation

**Infra**
- [x] Cognito `custom:orgId` attribute added to the user pool
- [x] Pre-token-generation Lambda trigger (`contexts/org/handlers/pre_token_trigger.py`) — pure function, no boto3 imports (Cognito 5s timeout)
- [x] API Gateway CORS origins + wildcard domain config updated
- [x] `backend/cdk/stack.py` parameterized by `stage_config` (staging vs prod)
- [x] RemovalPolicy stage-conditional — `DESTROY` on staging, `RETAIN` on prod

**Domain**
- [x] New `contexts/org/` bounded context — Organization, OrgSettings, Plan, Invite entities
- [x] `shared_kernel/tenant_keys.py` — centralized PK/SK builders with `ORG#{orgId}#...` prefix
- [x] `shared_kernel/auth_context.py` — `AuthContext.org_id` + `ContextVar` propagation so repos auto-scope
- [x] DynamoDB v2 key shape:
  - `PK=ORG#{org}#USER#{uid}`, `PK=ORG#{org}#PROJECT#{pid}`, `PK=ORG#{org}` (settings/plan/role)
  - `PK=SLUG#{slug}` — workspace-code → org_id resolver
  - `GSI1PK=USER_EMAIL#{email}` (global email uniqueness)
- [x] All 8 context repositories updated to use `tenant_keys.*` helpers
- [x] All 8 context mappers updated to emit v2 keys only (dual-write removed in step 10b)

**Data migration**
- [x] `backend/scripts/backfill_neurostack.py` — idempotent rewrite of every legacy item to v2 shape
- [x] `backend/scripts/backfill_cognito.py` — sets `custom:orgId=neurostack` on every existing Cognito user

**Public endpoints**
- [x] `POST /signup` — creates org + first owner user (two-phase with Cognito rollback)
- [x] `GET /orgs/by-slug/{slug}` — public workspace resolver for pre-auth theming

## Phase 2 — Invites & tenant user management

- [x] `POST /orgs/current/invites` — send invite (OWNER/ADMIN gated)
- [x] `GET /orgs/current/invites` — list pending/accepted/expired
- [x] `DELETE /orgs/current/invites/{token}` — revoke
- [x] `POST /invites/{token}/accept` — public acceptance endpoint, creates Cognito user
- [x] Gmail SMTP invite email via Secrets Manager (`taskflow/gmail-credentials`)
- [x] Frontend `/invite/[token]` page — collects name + password
- [x] `POST /users` gated to `user.create`; sets `custom:orgId` from caller's auth context (not request body)
- [x] Plan-limit check: refuses user/project creation when `count >= plan.max_*`
- [x] Invite UI consolidated into `/admin/users` page (Invite button next to Add user)
- [x] Deleted duplicate `/settings/users` page

## Phase 3 — Tenant configuration

**Backend**
- [x] `OrgSettings` entity with 14 tenant-configurable fields
- [x] `GET /orgs/current/settings` — hydrate settings at login
- [x] `PUT /orgs/current/settings` — OWNER-only update with Pydantic validation
- [x] Hex color, HH:MM time, display-name length validation

**Frontend**
- [x] `TenantProvider` React context — resolves slug from URL/localStorage/default
- [x] `TenantDocumentTitle` — sets browser tab title from `OrgSettings.displayName`
- [x] `lib/tenant/theme.ts` — injects CSS variables for primary/accent color
- [x] Tailwind config: CSS-variable theme tokens (`bg-primary`, `ring-ring`, etc.)
- [x] `useT()` + `BASE_TERMINOLOGY` with 33 override-able keys
- [x] `FeatureGate` component + feature-aware nav filtering
- [x] `lib/tenant/WorkspaceField.tsx` — workspace code input on login/signup
- [x] Settings page with 5 tabs: Branding · Terminology · Features · Locale · Leave types (Identity tab dropped — favicon folded into Branding)
- [x] **Branding**: display name, logo URL, favicon URL, primary + accent colors, `BrandingPreview`, `ColorField`
- [x] **Terminology**: replaced 33-key matrix with **Glossary** view — 4 noun cards (Task/Project/Member/Day-off) + Advanced disclosure
- [x] **Features**: switch list with label + description per toggle
- [x] **Locale**: timezone, locale, currency, week-start day, working hours
- [x] **Leave types**: CRUD list (name, id, annual quota)
- [x] Sticky save bar with per-tab dirty dots
- [x] Discard-changes per tab

## Phase 4 — Custom roles & permission matrix

**Domain**
- [x] 35-permission catalog in `contexts/org/domain/permissions.py`
- [x] `Role` entity (org_id, role_id, name, scope, is_system, permissions set)
- [x] `default_roles.py` — seeded at signup: OWNER (35 perms) / ADMIN (31) / MEMBER (9)
- [x] `shared_kernel/permissions.py` — `require(ctx, perm)` / `has_permission(ctx, perm)` with per-request cache
- [x] Pre-token Lambda now injects `custom:roleId` claim

**Endpoints** (single `roles_router` Lambda — saves CFN resources)
- [x] `GET /orgs/current/roles` — list roles + permission catalog
- [x] `POST /orgs/current/roles` — create custom role
- [x] `PUT /orgs/current/roles/{roleId}` — rename / edit permissions
- [x] `DELETE /orgs/current/roles/{roleId}` — custom roles only

**Handler conversions** (`PRIVILEGED_ROLES` → `require()`):
- [x] `update_settings`, `list_invites`, `revoke_invite`, `list_updates`, `update_user_department`, `create_direct_task`, `list_direct_tasks`, `get_project_status`
- [ ] ~10 use-case-level sites remain (non-blocking; fallback via legacy path)
- [ ] ProjectRole enum still hardcoded (Phase 4.5)

**Frontend**
- [x] `/settings/roles` editor page with permission matrix
- [x] `lib/permissions/catalog.ts` — friendly labels for all 35 permissions
- [x] Stat strip (Roles · Permissions · Most permissive)
- [x] Themed role cards: Crown (owner, amber) · ShieldCheck (admin, violet) · Users (member, sky) · Shield (custom, slate)
- [x] Permission-count progress bar + grouped domain preview
- [x] Create / edit modal with search, quick presets (All/Read-only/None), tri-state group toggles
- [x] Destructive badge on `*.delete` permissions
- [x] Amber system-role banner in edit modal

## Phase 5 — Custom task pipelines (foundation)

- [x] `Pipeline` entity + `PipelineStatus` value object
- [x] `default_pipelines.py` — 4 seeded pipelines (DEVELOPMENT / DESIGNING / MANAGEMENT / RESEARCH)
- [x] Pipelines folded into `GET /orgs/current` response (saved a route)
- [x] `lib/tenant/usePipelines.ts` — hook + `buildStatusIndex()` + `findPipeline()` helpers
- [x] `TaskBoard` kanban reads tenant pipeline order + status colors with hardcoded fallback for legacy data
- [ ] `/settings/pipelines` editor UI (endpoints write not yet exposed)
- [ ] Migrate `MemberDashboard`, `TaskDetailPanel`, `ProjectReport` off hardcoded `TASK_STATUS_LABEL` constants

## Phase 6 — Desktop + rate limiting

**Desktop** (separate repo at `desktop/`)
- [x] `internal/workspace/workspace.go` — atomic read/write of `~/.taskflow/workspace.json` with slug validation + full unit tests
- [x] API client sends `x-org-slug` header on every request
- [x] `OrgSettings` cache in API client with `ScreenshotsEnabled()` (fail-closed)
- [x] `internal/monitor/activity.go` — screenshot loop honors the feature gate per tick
- [x] `app.go` — `GetWorkspace` / `SetWorkspace` / `ClearWorkspace` Wails bindings
- [x] Settings refresh goroutine (10-min cadence, tied to session context)
- [ ] First-run Preact UI (workspace prompt screen)
- [ ] Tray "Switch workspace" menu item
- [ ] Drop `APP_NAME` from ldflags; read from `OrgSettings.displayName`

**Rate limiting**
- [x] WAFv2 Regional WebACL in CDK: per-workspace rate limit (`x-org-slug` header key) + per-IP ceiling
- [x] Stage-conditional (only attached in non-staging) to stay under the 500-resource CFN cap

## UI / UX catalog

All visible changes shipped across phases:

**Theming**
- [x] Live tenant colors via CSS variables (primary + accent)
- [x] Logo: TaskFlow as product brand with tenant name as subline
- [x] Per-tenant favicon + browser tab title

**Navigation**
- [x] Sidebar filters nav items by `features` map
- [x] "Admin areas" card under Settings page header (links to Roles)
- [x] Removed redundant sidebar entries after consolidation

**Settings**
- [x] 5-tab layout with sticky save bar + dirty dots
- [x] `BrandingPreview` live panel
- [x] `ColorField` with hex + swatch
- [x] `TerminologyPanel` (search + grouped key editor)
- [x] `GlossaryPanel` (4 noun cards with auto-derivation + Advanced disclosure)
- [x] `FeaturesPanel` (labeled switch list)
- [x] `LocalePanel` (timezone/locale/currency/hours)
- [x] `LeaveTypesPanel` (CRUD list)

**Roles page**
- [x] Stat strip with themed icons
- [x] Themed role cards + permission-count progress bar
- [x] Grouped permission preview (`task 6 · project 4 · ...`)
- [x] Modal editor with search, presets, tri-state toggles
- [x] Friendly permission labels from catalog
- [x] Destructive badges on `*.delete`

**Dashboard / task surfaces**
- [x] Kanban reads tenant pipeline colors
- [x] Daily Update (renamed from Task Update across 13 strings)
- [x] `DesktopAppCard` for OS downloads
- [x] TodayHero + TeamPulseStrip + WhoIsWorking dashboard cards
- [x] `BirthdayBanner` gated behind `features.birthdays`

**shadcn-style UI kit** — Button, Card, Badge, Alert, Dialog, Modal, Tabs, Select, Switch, DropdownMenu, Checkbox, DatePicker, Breadcrumbs, EmptyState, Spinner, Toast, Tooltip, Progress, ImageCropper, CommandPalette, PageHeader, ConfirmDialog, AlertDialog, FilterSelect, ScrollArea

**Animations + polish**
- [x] Page `animate-fade-in` + staggered entries on card grids
- [x] Hover-lift shadow on cards
- [x] Loading skeletons (roles page, etc.)
- [x] Walkthrough onboarding cards

**Auth pages**
- [x] Redesigned login / signup with tenant theming
- [x] Public `/invite/[token]` acceptance flow
- [x] Workspace-code field component

## Migration scripts

- [x] `backfill_neurostack.py` — Phase 1 v2 key rewrite (idempotent, dry-run)
- [x] `backfill_cognito.py` — sets `custom:orgId` on existing users
- [x] `backfill_phase4_phase5.py` — role permission matrix + default pipelines

## Staging deployment

- [x] Deployed end-to-end — stack `task-management-staging`, API URL `https://4saz9agwdi.execute-api.ap-south-1.amazonaws.com/staging/`
- [x] Deploy run verified (148s, exit 0, CloudFormation clean)
- [x] AWS identity confirmed: `giri-dev` account `013484737418` (personal/staging)
- [x] Backfills applied — 3 role records populated (owner=35 perms, admin=31, member=9), 4 default pipelines inserted (DEVELOPMENT / DESIGNING / MANAGEMENT / RESEARCH)
- [x] `features.screenshots: true` live for NEUROSTACK (desktop gate passes)
- [x] CDK synth clean — **494 / 500 resources** (6 headroom before stack-splitting required)

---

# Roadmap — ship-to-production TODOs

Everything below is still required to call this a finished SaaS product. Ordered roughly by priority; blocking items for prod rollout first.

## P0 — Blocks production rollout

### Infra & networking
- [ ] Split CDK stack into nested stacks (we're at 494/500 resources — next Lambda blocks)
- [ ] Wildcard ACM cert `*.taskflow.com` in `us-east-1` (cross-region stack)
- [ ] Route53 hosted zone + A records for `*.taskflow.com`
- [ ] API Gateway custom domain `api.taskflow.com` + base-path mapping
- [ ] CloudFront distribution in front of the web app
- [ ] DynamoDB PITR enabled in prod
- [ ] CloudWatch alarms (Lambda errors > 1% over 5m, throttle rate, 5xx rate)
- [ ] Log retention policy (90d default, 365d for audit-relevant logs)

### Data migrations
- [ ] Backfill Cognito `custom:orgId` on every existing NEUROSTACK user (script exists; run against prod)
- [ ] Run Phase 1 backfill against prod (cutover rehearsal against staging snapshot first)
- [ ] Cleanup sweep — delete legacy (non-`ORG#`) items after burn-in window

### Testing
- [ ] Fix pre-existing broken tests in `backend/tests/` (use new context import paths)
- [ ] New `tests/test_multitenancy.py` — cross-tenant isolation (Org A token cannot read Org B data)
- [ ] E2E test: signup → invite → accept → login flow
- [ ] Permission test: tenant-defined role restricts actions correctly
- [ ] Load test — 50 tenants × 20 users × realistic traffic

### Phase 4 completion
- [ ] Convert remaining ~10 use-case-level `PRIVILEGED_ROLES` checks to `require()`
- [ ] ProjectRole enum → per-org role records with `scope='project'` + matching permission keys
- [ ] Role assignment UI when creating/editing users (currently still uses SystemRole dropdown)
- [ ] Refresh-token flow on role change (force Amplify re-session after role edit)

### Phase 5 completion
- [ ] Pipeline CRUD endpoints (create / update / delete — currently only list)
- [ ] `/settings/pipelines` editor UI — drag-reorder statuses, color picker, add/remove steps
- [ ] Migrate remaining frontend consumers off hardcoded `TASK_STATUS_*` constants (`MemberDashboard`, `TaskDetailPanel`, `ProjectReport`, `ProjectUpcomingDeadlines`, `ProjectTaskBreakdown`)
- [ ] Backend: rename `Task.domain` → `Task.pipeline_id` with dual-read compat window

### Phase 6 completion (desktop)
- [ ] First-run Preact UI in `desktop/frontend/src/FirstRun.tsx` — workspace prompt screen
- [ ] Tray menu: "Switch workspace" item (calls `ClearWorkspace` + reopens first-run)
- [ ] Drop `APP_NAME` from `-ldflags`; read `OrgSettings.displayName` for tray tooltip
- [ ] Login flow: call `GET /orgs/by-slug/{slug}` before SRP to validate workspace exists (error UX)
- [ ] Build + test on macOS (currently Windows/Linux only)
- [ ] Code-signing: Windows Authenticode + macOS notarization + Linux .deb signing

## P1 — Required for a real SaaS business

### Billing (Stripe integration, deferred from original plan)
- [ ] Stripe account + webhook endpoint
- [ ] `POST /billing/subscribe` — create checkout session
- [ ] `POST /billing/webhook` — handle `customer.subscription.*` events, update `Plan.tier`
- [ ] `POST /billing/portal` — Stripe customer portal URL
- [ ] `/settings/billing` frontend page — current plan, invoices, payment method, upgrade button
- [ ] Trial-period handling (14-day default, enforced in `Plan` record)
- [ ] Grace period on failed payment (7 days read-only, then suspend)
- [ ] Plan-change preview (prorated credit, new limit check)
- [ ] Upgrade/downgrade flow with confirmation dialog
- [ ] Invoice history with PDF download

### Plan enforcement
- [ ] `contexts/upload/` — storage quota check before presign
- [ ] Nightly retention sweeper Lambda (delete activity heartbeats > `plan.retention_days`)
- [ ] Nightly seat-count reconciliation (in case invite accepts exceed plan)
- [ ] Limit-reached UI — banner with upgrade CTA when seats full, projects full, storage full
- [ ] Usage stats page: seats used, projects used, storage used, all vs plan limit

### Tenant lifecycle
- [ ] Org suspension flow (read-only mode when `status='SUSPENDED'`)
- [ ] Org deletion endpoint with 30-day soft-delete + data export
- [ ] Transfer ownership flow (new owner must accept)
- [ ] Member removal cascades (reassign owned tasks/projects, or block removal)
- [ ] Bulk CSV user import with dry-run + error report

### Security
- [ ] Email verification on signup (don't trust the address until clicked)
- [ ] Rate-limit the `/signup` endpoint specifically (stricter than general WAF rule)
- [ ] CAPTCHA on signup + password reset (Cloudflare Turnstile or hCaptcha)
- [ ] 2FA/MFA support via Cognito TOTP + SMS
- [ ] Session timeout + inactivity logout (configurable per-org)
- [ ] Password reset flow + password history (can't reuse last 5)
- [ ] Audit log — who changed what: settings edits, role changes, user creates/deletes, plan changes
- [ ] Audit log viewer UI at `/settings/audit`
- [ ] Rotate Gmail SMTP creds + move invite sender to SES (deliverability + cost)

### Auth upgrades
- [ ] "Forgot password" flow (currently only admin-reset path)
- [ ] Change email flow with re-verification
- [ ] Workspace discovery — "which workspaces does this email belong to?" after auth but before routing
- [ ] SSO / SAML for enterprise tier (Cognito federated identity providers)

### Observability
- [ ] Sentry for frontend + backend error tracking
- [ ] Datadog or CloudWatch dashboards — per-endpoint latency, error rate, throttles
- [ ] Structured JSON logging in every Lambda (correlation id per request)
- [ ] Health check endpoint (`GET /health`) + Pingdom/UptimeRobot monitor
- [ ] Status page (statuspage.io or Better Stack)

### CI/CD
- [ ] GitHub Actions: lint + type-check + test on every PR
- [ ] Automated staging deploy on merge to `saas-migration` branch
- [ ] Prod deploy workflow with manual approval gate
- [ ] Desktop build workflow — Windows + macOS + Linux + installer signing
- [ ] Semantic versioning + changelog automation

## P2 — Polish & growth

### Onboarding
- [ ] First-login walkthrough tour (react-joyride or custom)
- [ ] Sample project + sample tasks seeded on signup so workspace isn't empty
- [ ] Email sequence: welcome → day 1 tips → day 7 feature spotlight
- [ ] "Invite teammates" prompt on signup flow

### UX polish
- [ ] Empty states everywhere (tasks list, projects list, reports, etc.)
- [ ] Command palette (`⌘K`) expanded coverage across every page
- [ ] Keyboard shortcuts + shortcut-help modal
- [ ] Mobile responsive review (all pages currently desktop-first)
- [ ] Accessibility audit: keyboard nav, screen reader, color contrast, focus rings
- [ ] Dark mode coverage audit
- [ ] Loading skeletons on every async-loaded surface

### Features
- [ ] Comments @-mentions + notifications
- [ ] Task dependencies (blocks/blocked-by)
- [ ] Task templates
- [ ] Project templates
- [ ] Recurring tasks
- [ ] Gantt chart view
- [ ] Timeline view
- [ ] Custom fields on tasks
- [ ] File attachments on tasks (uses existing S3 presign)
- [ ] Activity feed per project
- [ ] Saved filters / saved views
- [ ] CSV / iCal exports

### Compliance & legal
- [ ] Terms of Service + Privacy Policy pages
- [ ] Cookie consent banner (EU traffic)
- [ ] Data Processing Agreement template
- [ ] GDPR: data export + deletion endpoints per user
- [ ] Subprocessor list page
- [ ] Security / Trust center page
- [ ] SOC 2 Type I audit prep (policies, access reviews, vendor reviews)

### Marketing
- [ ] Landing page at `taskflow.com`
- [ ] Pricing page
- [ ] Docs site (Mintlify or Docusaurus)
- [ ] Blog
- [ ] Public changelog
- [ ] Feature comparison vs competitors
- [ ] SEO: sitemap, OG tags, schema.org

## Desktop app — completion checklist

Beyond the P0 Phase 6 items above:

### Core
- [ ] First-run workspace screen — logo, workspace field, "Continue"
- [ ] Tray menu: Show TaskFlow / Toggle Timer / Switch Workspace / Sign Out / Quit
- [ ] In-app "About" screen with version + update-check button
- [ ] Auto-update end-to-end test (currently has `updater/` package but untested against real release)
- [ ] Log file rotation (~50 MB cap)
- [ ] Crash reporting

### Platform coverage
- [ ] macOS build — Wails dev + installer .dmg
- [ ] macOS notarization via Apple Developer ID
- [ ] Linux packages: `.deb`, `.rpm`, `.AppImage`
- [ ] Windows: SmartScreen reputation (Authenticode signing)
- [ ] Install-on-login option (registry/LaunchAgent/systemd)

### Monitoring features
- [ ] Multi-monitor screenshot capture (currently primary display only)
- [ ] Native idle detection per platform (replace 10-min heuristic):
  - Windows: `GetLastInputInfo`
  - macOS: `CGEventSourceSecondsSinceLastEventType`
  - Linux: `XScreenSaverQueryInfo`
- [ ] Native screen-lock detection (replace idle-time proxy for privacy)
- [ ] Native OS notifications (replace tray balloon on Windows)
- [ ] Disk-space cap for cached screenshots before upload

### UX
- [ ] Dark mode in desktop UI
- [ ] Keyboard shortcuts (Start/Stop timer, switch task)
- [ ] Offline queue — buffer heartbeats when network is down, flush on reconnect
- [ ] Per-workspace color accent in tray icon badge
- [ ] Task picker autocomplete

### Security
- [ ] Code-signing certificates (Windows EV cert recommended for SmartScreen)
- [ ] macOS notarization
- [ ] Linux repo signing key
- [ ] Keystore refactor — use OS keychain in a cross-platform library (current per-platform impl)
- [ ] Per-tenant allowlist for auto-update feed (prevents cross-tenant update hijacking)

### Config / deployment
- [ ] Drop baked `APP_NAME` / `WebDashboardURL` ldflags — read from tenant settings
- [ ] Keep only `APIURL` baked; everything else comes from `/orgs/current/settings`
- [ ] Release channel support: stable / beta / canary
- [ ] Telemetry opt-in (with privacy notice)


## Documentation

- [x] `SAAS-MIGRATION.md` — full phased plan
- [x] `SAAS-CHANGES.md` — running log
- [x] `SAAS-PROGRESS.md` — this file
- [x] `docs/PHASE-1-STAGING-DEPLOY.md` — deploy runbook
- [x] `Bug-Report-Go.md`, `Bug-Report-Go-v2.md` — desktop audit notes
- [x] `CLAUDE.md` updated with multi-tenant architecture
