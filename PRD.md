# TaskFlow — Product Requirements Document

**Version:** 2.4 (post-Session 9)
**Status:** V2 verified on staging + prod V2; legacy-prod cutover pending
**Last updated:** 2026-04-30

---

## 1. What is TaskFlow

TaskFlow is a **multi-tenant SaaS** for small and mid-sized teams to run their operational work: projects, tasks, attendance, day-offs, activity monitoring, and AI-generated work summaries — with a web app and a Windows/Linux/macOS desktop companion.

Any organization signs up at `taskflow.neurostack.in/signup`, picks a workspace code, and gets an isolated tenant with configurable branding, roles, task pipelines, terminology, and feature toggles — all with sensible defaults so the product works without touching settings.

Originally built as an internal tool for NEUROSTACK; now converted to a product anyone can use.

---

## 2. Personas

| Persona | Role in TaskFlow | Primary jobs |
|---|---|---|
| **Workspace Owner** | Created the tenant at signup | Branding, roles, billing, tenant-wide settings, ownership transfer |
| **Workspace Admin** | Promoted by Owner | User management, project creation, approvals, reports |
| **Member** | Invited by Owner/Admin | Work on tasks, clock in/out, submit updates, request day-offs |
| **Platform Operator** | Runs the SaaS (Anthropic-side role) | Suspend tenants, audit across tenants, cutover + recovery |

System roles are seeded at signup (`owner`, `admin`, `member`) but are backed by per-org role records, so an Owner can define custom roles with any permission subset.

---

## 3. Multi-tenant model

### Isolation
- **Pooled**: one DynamoDB table, one Cognito user pool, one S3 bucket
- Every tenant-scoped row prefixes `ORG#{orgId}#` in its partition key
- `AuthContext.org_id` propagates through a ContextVar so every repository auto-scopes reads/writes — handlers never thread `org_id` manually
- Contract test suite (`backend/tests/test_multitenancy.py`) gates cross-tenant reads at CI time

### Routing
- **No subdomain per tenant** — login is email + password only, the workspace is resolved from the JWT's `custom:orgId` claim after login
- Pre-login signup + login screens are generic; optional `?workspace={slug}` query param pre-themes the page (used by invite links)

### Tenant lifecycle
- **Signup**: two-phase — Cognito admin-create + DynamoDB transaction; rollback on any failure so there are no orphan Cognito users.
- **Invite**: OWNER/ADMIN sends email with single-use 7-day token; accept flow lets invitee set their own password.
- **Suspension**: platform-operator-only endpoint (env-allowlisted); suspended tenants see a full-page block, all writes return typed `ORG_SUSPENDED` 403.
- **Ownership transfer**: OWNER-only, typed-email confirmation; promotes target to OWNER and demotes current OWNER to ADMIN in one atomic action.
- **Deletion** (planned): 30-day soft-delete with data export, then hard-delete sweeper. Not yet implemented.

---

## 4. Core features

### 4.1 Authentication
- Cognito SRP (password never hits the server)
- Email verification on signup: new accounts have `email_verified=false`; post-login gate routes to a verify-email page that calls Cognito `GetUserAttributeVerificationCode` / `VerifyUserAttribute` via SDK
- Invite acceptance trusts the email (link receipt proves ownership)
- hCaptcha on signup (optional — activates when site key is configured; WAF rate-limit is always on)
- Password policy: 8+ chars, upper, lower, digit
- **2FA via Cognito TOTP** — users opt in from `/profile/mfa` (QR enroll + manual secret); login flow swaps to a 6-digit authenticator-code prompt when a TOTP factor is enabled
- **Self-service email change** at `/profile/change-email` — Cognito `updateAttributes` sends a code to the new address, user confirms, backend syncs the DDB record
- OWNER can **reset a member's 2FA** from the Users page when they lose their authenticator

### 4.2 Projects & tasks
- Per-org **pipelines**: Owner defines named pipelines (DEVELOPMENT, DESIGN, SALES, whatever) with ordered status columns and colors
- Tasks live in projects; status must match the pipeline's declared statuses
- Kanban board + list view + detail panel
- Comments, attachments (S3 + CloudFront CDN)
- Assignee notification emails, daily task updates

### 4.3 Roles & permissions
- **35 permission strings** (`task.create`, `role.manage`, `settings.edit`, `billing.view`, ...)
- Owner can create, clone, or delete custom **system-** or **project-scope** roles in `/settings/roles` with a matrix editor
- Four default project roles seeded at signup (`project_admin`, `project_manager`, `team_lead`, `project_member`) — tenants can clone/edit but not delete
- MemberList dropdowns populate from the API so tenant-defined custom project roles appear alongside defaults
- Permission resolution cached per Lambda invocation; cache invalidated when a role is edited so changes take effect without re-login

### 4.4 Attendance & activity
- Live timer with task switching, meeting mode, mandatory description
- Desktop app captures keyboard + mouse counts (event counts only — no keystrokes) and periodic screenshots (with 5-second warning + skip on locked screens)
- Per-tenant feature flags: `activity_monitoring`, `screenshots`, `ai_summaries` can each be disabled
- Activity retention enforced nightly (Lambda deletes rows past `plan.retention_days`)
- **Composite activity score** (Session 8): `score = 0.7 × presence + 0.3 × intensity` where presence is the active/total-minutes ratio and intensity normalises keyboard+mouse against a target throughput. Punishes wiggle-farming, caps power-typists at 1.0, and is unit-tested ([backend/tests/test_domain_activity.py](backend/tests/test_domain_activity.py)). The AI summary prompt receives the objective score directly and is forbidden from inventing numbers.

### 4.5 Day-offs
- Request → approve/reject workflow
- Leave types are per-org (casual/sick/earned by default, customizable)
- Self-approval blocked at API layer

### 4.6 Reports & AI summaries
- Summary / detailed / weekly / activity views with Recharts
- Groq LLaMA 3.3 generates daily productivity summaries (**PRO-tier**, feature-flagged per tenant)
- **Weekly AI rollup** (Session 8): aggregates a full week's task updates **plus attendance, activity, and day-off** records into a single editorial recap; each data source is wrapped so a single repo failure can't torpedo the rollup. Also **PRO-tier** as of Session 9.
- **AI plan-tier migration (Session 9)**: `ai_summaries` moved from `FREE_FEATURES` into `PRO_FEATURES`. Both AI surfaces share the umbrella `ai_summaries` flag; one plan upgrade unlocks both. The `require_feature()` backend helper now checks `plan.features_allowed` first (raises typed `PLAN_FEATURE_LOCKED`) before checking the OWNER's settings toggle (raises `FEATURE_DISABLED`); the frontend `<FeatureGate>` and `<FeaturesPanel>` mirror both checks so PRO-only affordances hide cleanly on FREE plans.
- **Project Reports tab** restructured (Session 8) into inner tabs (Overview / Workload / Sessions) with a consolidated period+navigator+export toolbar, pixel-grid metric strip, and donut without tooltip-collision
- CSV export for attendance

### 4.7 Branding & terminology
- **5-up curated theme picker** (Session 9): one of five professionally-paired light+dark palettes (Aurora / Slate / Sunset / Forest / Mono) seeded into `OrgSettings.theme`. The picker writes the entire palette (background, card, primary, accent, sidebar) for both modes — members get the same look in light AND dark without per-mode tuning.
- **Curated font picker** (Session 9): seven professional sans-serifs (Outfit/Inter/Manrope/Plus Jakarta Sans/Lexend/DM Sans/IBM Plex Sans) selectable per workspace via `OrgSettings.fontFamily`. Lazy-loads stylesheet on apply; falls back to the default Outfit when null.
- Logo + favicon uploads (S3 + CDN)
- Terminology overrides: tenant can rename "Task" → "Ticket", "Project" → "Engagement", etc. Runtime `useT()` hook reads the override map.
- Locale: timezone, currency, week-start day, working hours
- **Settings nav rename** (Session 9): the destructive group ("Transfer ownership" + "Delete workspace") is now labelled **"Workspace controls"** instead of "Danger zone" — neutral enterprise-grade phrasing, with link colors restored from muted-grey to normal nav weight (hover still flips destructive-red to preserve gravity signal).

### 4.8 Plans & quotas
- **FREE**: 10 users, 3 projects, 30-day retention. Includes activity tracking (counts only), desktop apps, day-offs, comments, daily updates, birthday wishes.
- **PRO**: 50 users, 50 projects, 365-day retention. Adds **AI daily summaries + weekly rollup**, periodic screenshots, custom roles, custom pipelines, HMAC webhooks, **3rd-party integrations** (Freshworks today; more connectors planned), public REST API (planned), priority email support.
- **ENTERPRISE**: unlimited members/projects, unlimited retention, white-label branding, dedicated infra on request, named CSM + SLA. SAML/OIDC SSO, SCIM provisioning, and custom domain are on the roadmap (visible on the pricing page with a "Soon" tag, not yet shipping).
- **Capacity caps** (`max_users`, `max_projects`) enforced **at write-time** in `CreateUserUseCase`, `SendInviteUseCase`, and `CreateProjectUseCase` — the user gets an actionable error before the row is created. Belt-and-braces: a nightly seat-reconciliation Lambda audits any race-induced overflow.
- **Feature flags** (`ai_summaries`, `screenshots`, `custom_roles`, `custom_pipelines`, `audit_logs`, `sso`, `white_label`, `custom_domain`, `api_access`) live on `Plan.features_allowed` and are checked at handler entry. **As of Session 9 the actively gated flags are `ai_summaries` and `screenshots`** — the rest still rely on the shared `plan_limits` helper to land. `require_feature()` distinguishes plan-locked (raises `PLAN_FEATURE_LOCKED` for upsell prompts) from settings-disabled (raises `FEATURE_DISABLED` for "ask your owner") — both gates fail-open on lookup error to avoid transient outages locking everyone out.
- **Retention** enforced by a nightly sweeper (`activity/handlers/retention_sweeper.py`) that deletes rows past `plan.retention_days`. Currently sweeps `ACTIVITY#` items only — extending to `EVENT#` audit rows is a known gap.
- Stripe integration not yet implemented; plan tier is set manually on the Org record. Full design and rollout plan in [docs/architecture/PLAN-LIMITS.md](docs/architecture/PLAN-LIMITS.md).

### 4.9 Audit log
- Every sensitive action (role edit, ownership transfer, suspension, plan change, webhook CRUD, platform flag toggle) writes to `PK=ORG#{org}#AUDIT`
- Full viewer UI at `/settings/audit` — action-prefix filters (Roles / Settings / Users / Pipelines / Organization / Plan / Webhooks / Platform), free-text search, cursor-based pagination, expandable before/after/metadata JSON
- Friendly action labels for every known action string; unknown actions fall through to the raw name so no event is hidden

### 4.10 In-app notifications
- Per-user partition keyed on `PK=ORG#{org}#USER#{userId}` / `SK=NOTIF#{ts}#{id}`; reverse-chron reads via `Query ScanIndexForward=false`
- Bell icon (NotificationCenter) polls `GET /users/me/notifications` every 30s, merges with existing client-derived notifications (overdue tasks, running timer)
- Mark-read per-item + "Mark all read"; unread items surface a filled dot + bold text
- First emitter wired: task assignment (`notifications.create` called from `assign_task` handler). Future emitters: dayoff outcomes, invite acceptance, @mentions in comments

### 4.11 Outbound webhooks
- Per-org subscriptions at `PK=ORG#{org}` / `SK=WEBHOOK#{id}`; each subscribes to a set of event types or the `*` wildcard
- **HMAC-SHA256 signed deliveries**: `X-TaskFlow-Signature: t={ts},v1={hmac}` — Stripe-compatible shape so subscriber libraries work with minimal tweaks
- Fires synchronously from emitter handlers (5-second per-URL timeout; failures logged, not retried — subscribers reconcile via API for guaranteed consistency)
- `/settings/webhooks` UI — list / create / edit / delete / enable-toggle; secret revealed ONCE on create with copy-to-clipboard, subsequent reads mask it
- Current event types: `task.created`, `task.assigned`, `task.completed`, `dayoff.*`, `user.invited`, `user.created`. First wiring: task.assigned.
- Retry queue + dead-letter handling deferred to future work once a tenant needs stronger guarantees

### 4.12 Platform operator console
- `/platform` frontend page — slug lookup (via existing public `GET /orgs/by-slug/{slug}`), suspend/unsuspend, per-tenant feature-flag toggles
- Frontend gate: `NEXT_PUBLIC_PLATFORM_ADMIN_USER_IDS` env (must mirror backend `PLATFORM_ADMIN_USER_IDS`). Non-admins get redirected; backend enforces real auth.
- Backend endpoints: `POST /platform/orgs/{orgId}/status` (suspend/resume), `PATCH /platform/orgs/{orgId}/features` (shallow-merge features map). Both audit under the target tenant's timeline.

### 4.13 Internationalization
- `useTenant().settings` carries `locale` (BCP-47), `timezone` (IANA), `currency` (ISO-4217), `weekStartDay`
- `useFormat()` hook exposes `{ date, time, number, currency, relative }` bound to the current tenant settings — same amount renders as ₹1,00,000 for an IN-locale tenant and $100,000.00 for a US-locale tenant without call-site branching
- Pure `lib/utils/format.ts` helpers are locale-explicit + testable + Server-Component-safe
- Terminology overrides (per-org word swaps like "task" → "ticket") layer separately via `useT()` — shipped in Phase 3
- Migration of existing `toLocaleDateString('en-US', ...)` call sites to `fmt.date()` is incremental (~35 remaining)

### 4.14 Desktop companion
- Same timer + activity features as web
- DPAPI-encrypted token storage on Windows
- Auto-update via GitHub releases (signed, planned — code-signing not yet purchased)
- macOS build + DMG (planned — needs a Mac build host)

### 4.15 First-run onboarding checklist (Session 8)
- A four-step "Finish setting up your workspace" card on the OWNER's dashboard: invite teammates, create a project, install the desktop app, customise branding
- Steps tick off automatically when their backing condition is met (real users / projects / colour customisation), or manually via "I installed it" / "Mark done" buttons for steps the server can't directly observe
- **State persists in `OrgSettings.features`** under `onboarding_checklist_dismissed`, `onboarding_desktop_installed`, `onboarding_branding_done` — same dismiss state on every browser/device, no per-device localStorage drift
- Card hides itself when all four steps are done OR the OWNER clicks the dismiss ✕

### 4.16a Departments catalog (Session 9)
- OWNER-managed list of departments under Settings → Organization → Departments. Stored as `OrgSettings.departments` (a JSON array of strings) on the existing settings record — no separate partition needed.
- Drives:
  - The Department dropdown on the **Add user** form in `/admin/users` (replaces the previous hardcoded `Development / Designing / Management / Research` list)
  - The Department filter chip on the admin Users page
- Empty list is a valid OWNER choice (a workspace might not need departments at all). Legacy tenants without the field are seeded with a six-item default (Engineering / Design / Product / Marketing / Operations / People) the first time the panel renders.
- Inline rename, drag-handle reorder via ▲▼ chevrons, delete with optional "Restore defaults" empty-state action.

### 4.16b Integrations platform (Session 9)
- Pluggable connector framework so 3rd-party tools (helpdesks, chat, source control, calendar) can sync work into TaskFlow tasks. Lives in its own bounded context (`backend/src/contexts/integrations/`) with a strict connector protocol contract enforced by CI tests.
- **PRO-tier** feature, gated by `require_feature(auth, "integrations")` and the new `plan_gate.py` use case.
- **First connector: Freshworks** (covers Freshdesk + Freshservice). Inbound webhook → idempotent `upsert_task_from_external` flow that creates or updates a TaskFlow task per ticket. Field mapping is per-connector and unit-tested.
- HMAC-SHA256 webhook signature verification on inbound traffic; KMS-encrypted credentials at rest; per-tenant + per-provider isolation enforced by namespace tests so a Freshdesk webhook can't write into a Freshservice integration's data.
- Dedicated nested CDK stack (`IntegrationsNestedStack`) with its own API Gateway domain (configured via `NEXT_PUBLIC_INTEGRATIONS_API_URL` on the frontend) so integration traffic stays isolated from the main API.
- Frontend surface under `/settings/integrations` — browse providers, dynamic connect form (per-provider schema), per-integration detail page with disconnect, Freshdesk webhook setup guide with copy-to-clipboard helpers.
- 8 contract/connector tests in `backend/tests/integrations/` (protocol compliance, namespace isolation, error swallowing, field mapping, inbound/outbound flow, webhook signature, parser).

### 4.16 Marketing surface (Session 8, refined Session 9)
- Landing page at `/` rebuilt with **glassmorphism** treatments across Hero, Problem, Features, How-it-works, FAQ, and Final-CTA sections (Lexend display face replaced by the tenant-cascade font system in Session 9 so the landing inherits whatever the workspace picks)
- Pricing card is a three-tier glass grid (Free / Pro / Enterprise); aspirational items (SSO, SCIM, custom domain, public REST API) carry a muted **"Soon"** pill. **Session 9 fix**: AI bullet correctly placed under Pro (was previously listed under Free); Pro tier description leads with "AI-assisted reporting"
- Page transitions use a pure-opacity `fade` variant — the previous `rise` variant created a CSS containing block on the wrapper that defeated `position: fixed` for the landing header, so the bar would scroll with the page
- Public legal/security/status pages: `/privacy`, `/terms`, `/security`, `/status`, `/download`

### 4.17 Responsive UX (Session 9)
- Mobile-safe modals: `Dialog` content uses `w-[calc(100vw-2rem)]` mobile gutter, `sm:w-full` from tablet+; tighter padding on phones so dialogs no longer touch screen edges
- Mobile sidebar drawer: `Sheet` width `w-[85vw] max-w-[320px] sm:w-[280px]` so phones get a thumb-sized swipe gutter
- Wide tables (day-offs ×3, reports member-hours, bulk-import preview/result, time-report sessions) wrapped in `overflow-x-auto` so they scroll horizontally inside their card on phones rather than overflowing
- Weekly leaderboard: rank column 36→28px, share bar 140→80px, gap and padding tightened on mobile; row template grid mirrors the header at every breakpoint so columns stay aligned
- TodayHero alerts converted from a tall vertical list into a wrap-row of compact chips, so the column never grows taller than the greeting regardless of alert count
- Toast width clamped to `w-[calc(100vw-2rem)] max-w-[420px] sm:w-auto sm:min-w-[280px]` — toasts no longer require horizontal scroll on narrow viewports

### 4.18 Operational tooling (Session 9)
- **`backend/scripts/force_signout_all.py`** — one-off CLI to close every currently-signed-in attendance session for a tenant. Use when "Working now" gets stuck full of demo seed users or clients that crashed before posting sign-out. Different from the scheduled stale-session sweeper — unconditional and immediate, scoped to today + yesterday in IST. Dry-run by default.
- Lint script swap: `next lint` was removed in Next.js 16, replaced with `tsc --noEmit` in `frontend/package.json`. CI now runs the typechecker as the gate.
- React 18 → React 19 upgrade — Next 16's internal Router uses React-19-only hook semantics; pairing it with React 18 produced random "Rendered more hooks" errors in the app router.

---

## 5. What ships today vs. what's planned

### Production-ready (verified on V2)
Multi-tenancy, signup, invites, system + project-scope RBAC (per-org), custom pipelines, audit viewer with friendly labels, suspension endpoint + UI, ownership transfer, health check, hCaptcha, Sentry scaffold, CI/CD, WAFv2 rate limiting, DynamoDB PITR, CloudWatch alarms, seat reconciliation, activity retention sweeper, email verification, TOTP 2FA, 30-day soft-delete + JSON export + hard-delete sweeper, change-email self-service, bulk CSV user import, in-app notifications, outbound webhooks with HMAC signing, platform operator console, i18n foundation, composite activity score formula, weekly AI rollup with multi-source enrichment, server-persisted onboarding checklist, glass landing + 3-tier pricing surface, restructured Project Reports with inner tabs, **AI features migrated to PRO (`require_feature` now plan-aware), 5-up theme picker, curated font picker, departments catalog, Freshworks integration platform on the new IntegrationsNestedStack, "Workspace controls" settings nav rename, full responsive overhaul, force-signout admin script.**

### Before legacy-prod cutover
- Run backfill script against the company AWS account legacy stack
- Set operator env vars (`PLATFORM_ADMIN_USER_IDS` + frontend mirror) for the platform console
- Optional: set `HCAPTCHA_SECRET` + `SENTRY_DSN` to activate those systems
- Verify the integrations webhook DNS + KMS key align with legacy expectations

### Post-launch backlog
- SES migration from Gmail SMTP (current cap ~500/day via Gmail)
- Desktop first-run UI (Preact login, separate repo)
- Desktop macOS build + `.dmg` (needs Mac CI)
- Code-signing: Windows Authenticode, macOS notarization, Linux repo key
- SSO / SAML / OIDC federation (Enterprise)
- SCIM provisioning + directory sync (Enterprise)
- Custom domain per tenant (Enterprise — needs ACM + per-tenant CloudFront alias automation)
- Stripe billing integration + plan-upgrade audit events
- `shared_kernel/plan_limits.py` helper to dedupe the four existing enforcement sites and unblock gating for `custom_roles`, `custom_pipelines`, `audit_logs`, `white_label`, `api_access`, `sso` — design in [docs/architecture/PLAN-LIMITS.md](docs/architecture/PLAN-LIMITS.md)
- Frontend `<FeatureGate>` + `<UpgradePrompt>` components for soft-gating UI
- Public REST API + personal access tokens (Pro tier)
- Extend `retention_sweeper` to also delete `EVENT#` audit-log rows past `plan.retention_days` (currently sweeps `ACTIVITY#` only)
- Extract audit-log standalone CSV export from `/settings/audit` (today the log is only downloadable as part of the full workspace JSON export)
- Full i18n sweep (~35 call sites) migrating from `toLocaleDateString('en-US', ...)` to `useFormat()`
- Webhook retry queue + dead-letter (sync-only in v1)
- Additional notification emitters (day-off outcomes, invite acceptance, @mentions)
- Marketing site + compliance pages (ToS, Privacy, DPA — stubs shipped, legal review outstanding)

---

## 6. Success metrics

No public analytics yet. When billing is live, the metrics we'll track are:

1. **Time-to-first-task** from signup → first task created (target: <10 min)
2. **D7 retention** of signup owners
3. **Seats used / seats purchased** per paying tenant
4. **Free → Pro conversion rate**
5. **Support ticket rate per tenant** (leading indicator for product gaps)

Until then, the signal is: the operator can stand up a new tenant, run through the golden path (signup → invite → create project → create task → clock in → submit update → approve day-off → generate AI summary) without hitting an error.

---

## 7. Open product questions

- **Deletion**: self-serve or operator-only? If self-serve, how many days of recovery? What's in the export zip (CSV vs. JSON)?
- **Billing**: Stripe subscription per seat, or tier-based flat? Billing owner separate from workspace owner?
- **Custom domain per tenant**: worth offering on Enterprise? Adds ACM + DNS automation complexity.
- **SSO**: Google Workspace first, then Okta/Azure AD? Or SAML generic?

These are discovery items — not blocked, but waiting on real-tenant feedback to prioritize.
