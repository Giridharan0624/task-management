# TaskFlow — Product Requirements Document

**Version:** 2.2 (post-Session 7)
**Status:** Staging verified, prod cutover pending
**Last updated:** 2026-04-22

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

### 4.5 Day-offs
- Request → approve/reject workflow
- Leave types are per-org (casual/sick/earned by default, customizable)
- Self-approval blocked at API layer

### 4.6 Reports & AI summaries
- Summary / detailed / weekly / activity views with Recharts
- Groq LLaMA 3.3 generates daily productivity summaries (feature-flagged per tenant)
- CSV export for attendance

### 4.7 Branding & terminology
- Per-org primary + accent colors propagated via CSS variables
- Logo + favicon uploads (S3 + CDN)
- Terminology overrides: tenant can rename "Task" → "Ticket", "Project" → "Engagement", etc. Runtime `useT()` hook reads the override map.
- Locale: timezone, currency, week-start day, working hours

### 4.8 Plans & quotas
- **FREE**: 10 users, 3 projects, 30-day retention
- **PRO**: 50 users, 50 projects, 365-day retention
- **ENTERPRISE**: unlimited
- Quotas enforced in code at every create site + nightly seat reconciliation
- Stripe integration not yet implemented; plan tier is set manually on the Org record

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

### 4.10 Desktop companion
- Same timer + activity features as web
- DPAPI-encrypted token storage on Windows
- Auto-update via GitHub releases (signed, planned — code-signing not yet purchased)
- macOS build + DMG (planned — needs a Mac build host)

---

## 5. What ships today vs. what's planned

### Production-ready (verified on staging)
Multi-tenancy, signup, invites, system + project-scope RBAC (per-org), custom pipelines, audit viewer with friendly labels, suspension endpoint + UI, ownership transfer, health check, hCaptcha, Sentry scaffold, CI/CD, WAFv2 rate limiting, DynamoDB PITR, CloudWatch alarms, seat reconciliation, activity retention sweeper, email verification, **TOTP 2FA, 30-day soft-delete + JSON export + hard-delete sweeper, change-email self-service, bulk CSV user import, in-app notifications, outbound webhooks with HMAC signing, platform operator console, i18n foundation.**

### Before prod cutover
- Run backfill script against the company AWS account
- Set operator env vars (`PLATFORM_ADMIN_USER_IDS` + frontend mirror) for the platform console
- Optional: set `HCAPTCHA_SECRET` + `SENTRY_DSN` to activate those systems

### Post-launch backlog
- SES migration from Gmail SMTP (current cap ~500/day via Gmail)
- Desktop first-run UI (Preact login, separate repo)
- Desktop macOS build + `.dmg` (needs Mac CI)
- Code-signing: Windows Authenticode, macOS notarization, Linux repo key
- SSO / SAML federation
- Stripe billing integration
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
