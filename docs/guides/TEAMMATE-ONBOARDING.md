# TaskFlow — Teammate Onboarding

Welcome. This document is the single-file brain-dump meant to get a new engineer productive on TaskFlow in one sitting. Read it top-to-bottom before touching any code. Links throughout point to deeper docs.

---

## 1. What is TaskFlow?

A multi-tenant SaaS task-management platform. Each customer (a **workspace / org**) gets:

- Project + task tracking (with cross-project Kanban)
- Time tracking via attendance sign-in/out + a desktop timer
- Daily work summaries ("Task Updates")
- Day-off requests with approval flow
- Cross-project time reports + exports
- Custom branding, terminology, and feature toggles per tenant

There are **three deployable units** in this monorepo:

| Unit | Stack | Deploys to | Purpose |
|---|---|---|---|
| `backend/` | Python 3.12 Lambda + DynamoDB + Cognito | AWS via CDK | HTTP API — single Lambda per route |
| `frontend/` | Next.js 16 App Router + React Query + shadcn/ui | Vercel | Web dashboard for admins and members |
| `desktop/` | Go 1.22 + Wails v2 + Preact | Windows/Linux/macOS installers | Timer, activity counters, screenshots |

All three share one REST API and one Cognito User Pool.

---

## 2. Repo layout at a glance

```
task-management/
├── CLAUDE.md                  ← read this — project instructions for AI + humans
├── SAAS-MIGRATION.md          ← full phased plan for multi-tenant conversion
├── SAAS-CHANGES.md            ← running log of what each phase shipped
├── SAAS-PROGRESS.md           ← current state snapshot
├── README.md
├── backend/
│   ├── src/
│   │   ├── contexts/          ← DDD bounded contexts (see §4)
│   │   └── shared_kernel/     ← auth, tenant keys, dynamo client, errors
│   ├── cdk/                   ← infrastructure as code
│   │   ├── app.py             ← PROD entry (--profile company)
│   │   ├── app_staging.py     ← STAGING entry (default profile)
│   │   ├── app_company.py     ← NEUROSTACK prod tenant w/ custom domain
│   │   └── stack.py           ← ~32 Lambdas + ~51 routes wired here
│   ├── tests/
│   ├── scripts/               ← backfill_neurostack.py etc.
│   └── API.md                 ← endpoint reference
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/        ← login, signup, invite
│   │   │   └── (dashboard)/   ← authenticated pages
│   │   ├── components/        ← see §6
│   │   ├── lib/
│   │   │   ├── api/           ← thin fetch wrappers per resource
│   │   │   ├── auth/          ← AuthProvider + cognito client
│   │   │   ├── hooks/         ← React Query wrappers + useCountUp etc.
│   │   │   ├── tenant/        ← workspace resolver + branding
│   │   │   └── utils.ts       ← cn() helper
│   │   └── types/
│   ├── components.json        ← shadcn config
│   └── tailwind.config.ts
├── desktop/
│   ├── cmd/                   ← main entry
│   ├── internal/
│   │   ├── auth/              ← Cognito SRP + OS credential storage
│   │   ├── api/               ← HTTP client (TLS 1.3 floor)
│   │   ├── monitor/           ← activity counters, screenshots
│   │   ├── tray/              ← Win32/X11/AppKit tray
│   │   └── updater/           ← GitHub releases check
│   ├── frontend/              ← Preact UI
│   └── Makefile
└── docs/                      ← deeper references
    ├── RBAC-DOCUMENTATION.md
    ├── TIMER-ARCHITECTURE.md
    ├── FEATURE-DEVELOPMENT-GUIDE.md
    └── ...
```

---

## 3. Dev environment setup

### Prerequisites

- Node 20+, npm
- Python 3.12, pip, AWS CLI with credentials configured (`default` profile for staging, `company` profile for prod)
- Go 1.22, Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- AWS CDK v2 (`npm install -g aws-cdk`)

### Backend

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest                                   # run full test suite
pytest tests/test_domain_user.py -k foo  # single test

cd cdk
cdk bootstrap                                       # first time only
cdk deploy --app "python app_staging.py"            # STAGING — default profile
cdk deploy --profile company                        # PROD (app.py)
```

**Critical deploy rules (from `CLAUDE.md`):**
- **Staging = personal AWS account, default profile, `app_staging.py`.**
- **Prod = company AWS account, `--profile company`, `app.py` or `app_company.py`.**
- **Never deploy to prod without verifying end-to-end on staging first.**
- **Never edit `app.py` to add staging-only knobs** — put them in `app_staging.py`.

### Frontend

```bash
cd frontend
npm install
npm run dev        # localhost:3000
npm run build
npm run lint
```

`frontend/.env.local` must define:
```
NEXT_PUBLIC_API_URL=...                    ← from CDK stack output
NEXT_PUBLIC_COGNITO_USER_POOL_ID=...
NEXT_PUBLIC_COGNITO_CLIENT_ID=...
NEXT_PUBLIC_AWS_REGION=ap-south-1
```
All four values come from `backend/output.json` after `cdk deploy`.

### Desktop

```bash
cd desktop
wails dev                                       # hot-reload dev
make check                                      # cross-compile sanity
make windows                                    # build .exe with ldflags
powershell -File build-installer-staging.ps1    # NSIS installer (staging)
powershell -File build-installer.ps1            # NSIS installer (prod)
```

Config values (API URL, Cognito IDs, dashboard URL, version) are injected at build time via `-ldflags` — see `desktop/Makefile`. **They are NOT read from `config.json` at runtime.** Don't waste time editing the JSON expecting it to take effect.

---

## 4. Backend architecture — DDD bounded contexts on one Lambda stack

Each context in `backend/src/contexts/` follows the same four-layer split:

```
contexts/<context>/
├── domain/          ← entities, value objects, repo interfaces
├── application/     ← use cases + authorization
├── infrastructure/  ← DynamoDB repo + mappers
└── handlers/        ← Lambda entry points (one per route)
```

Current contexts: `user`, `project`, `task`, `comment`, `attendance`, `dayoff`, `taskupdate`, `activity`, `upload`, `org`.

`backend/cdk/stack.py` wires every handler module to an API Gateway route + dedicated Lambda. **Adding a new endpoint = new handler module + new route in `stack.py`.**

### Every authenticated handler starts with one line

```python
from shared_kernel.auth_context import extract_auth_context

def handler(event, context):
    auth = extract_auth_context(event)
    # ...
```

`extract_auth_context` does three things:
1. Reads `sub`, `email`, `custom:orgId`, `custom:systemRole` from the Cognito JWT.
2. **Re-reads the authoritative `system_role` from DynamoDB** so role changes take effect without re-login.
3. Stamps `org_id` into a `ContextVar`, so repositories instantiated later **automatically scope reads/writes** — handlers don't thread `org_id` through every call site.

### Shared helpers (`shared_kernel/`)

- `validate_body(Model, event["body"])` — Pydantic parse with JSON error handling.
- `build_success(status, data)` / `build_error(exception)` — CORS headers + response envelope.
- `errors.py` — shared exceptions → HTTP codes.
- `dynamo_client.get_table()` — single reused boto3 resource.
- **`tenant_keys.py`** — all DynamoDB PK/SK construction goes through here. **Never string-format a PK inline.**

---

## 5. Multi-tenancy — how one DynamoDB table, one Cognito pool, and one S3 bucket serve N customers

One table, one pool, one bucket, with `org_id` prefixed into every non-global key.

### Key shape

```
PK=ORG#{org}#USER#{userId}         SK=PROFILE
PK=ORG#{org}#PROJECT#{pid}         SK=METADATA | MEMBER#{uid} | TASK#{tid}
PK=ORG#{org}                       SK=ORG | SETTINGS | PLAN | ROLE#{id} | PIPELINE#{id} | INVITE#{token}
PK=SLUG#{slug}                     SK=ORG                     ← workspace-code → org_id (global)
GSI1PK=USER_EMAIL#{email}                                     ← email globally unique
GSI2PK=ORG#{org}#EMPLOYEE#{eid}                                ← employee IDs per-tenant
```

- `DEFAULT_ORG_ID = "neurostack"` — fallback when a legacy token has no `custom:orgId`.
- **Aggregate list keys (`ORG#{id}#USER#LIST` etc.) are forbidden** — they create hot partitions. Use scoped PK queries.
- Phase 1 of the migration completed dual-write + read cutover. **New code only emits v2 keys.**

### S3 tenant isolation

Every upload is keyed `orgs/{orgId}/{userId}/{filename}`. The presign handler reads `orgId` from `AuthContext` and **refuses any key outside the tenant's prefix** — isolation is enforced at presign time, not just via bucket policy.

### Cognito auth flow

- **SRP authentication** — password never leaves the browser (`amazon-cognito-identity-js`).
- ID token carries `custom:orgId` and `custom:systemRole`, injected by the **pre-token-generation Lambda** at `backend/src/contexts/org/handlers/pre_token_trigger.py`.
- Login UI asks for workspace code + email + password. The workspace code themes the login screen and validates that `custom:orgId` matches — it is **not** part of the credential.
- **Signup is two-phase:**
  1. `admin_create_user` in Cognito
  2. `TransactWriteItems` for org + settings + first user
  3. If step 2 fails → `admin_delete_user` to prevent orphan Cognito users.

### Tenant branding at runtime (frontend)

`TenantProvider` resolves the workspace slug → org → branding config, then writes CSS variables to the document root:

```css
:root {
  --color-primary: 59 130 246;   /* RGB triplet, not hex — for alpha */
  --color-accent: 139 92 246;
}
```

All Tailwind utilities reference these through semantic tokens (`bg-primary`, `text-primary-foreground`). **Never hardcode a brand color in a component.**

---

## 6. Frontend architecture — pages, widgets, and the UI system

### 6.1 Routing

Next.js App Router with two route groups:

- `(auth)/` — login, signup, invite acceptance
- `(dashboard)/` — every authenticated page, shares the sidebar layout

### 6.2 Data layer

- `frontend/src/lib/api/<resource>.ts` — thin `fetch` wrappers, one file per resource.
- `frontend/src/lib/hooks/<useResource>.ts` — React Query wrappers around those API calls. **All UI reads go through React Query** — no direct `fetch` in components.
- Mutation hooks invalidate relevant query keys on success — check existing ones for the pattern before writing a new one.

### 6.3 UI system — shadcn/ui + Radix + CVA + Tailwind

Everything UI-wise was rebuilt on shadcn in this migration. Key foundation pieces:

| File | What it does |
|---|---|
| `src/lib/utils.ts` | `cn()` helper — `clsx` + `twMerge` |
| `components.json` | shadcn config (baseColor: slate) |
| `tailwind.config.ts` | semantic tokens + tenant RGB triplets + keyframes |
| `src/app/globals.css` | HSL tokens for shadcn + tenant RGB + stagger-up, breathe, drift animations + `prefers-reduced-motion` fallback |
| `src/lib/hooks/useCountUp.ts` | RAF-based number animator, easeOutCubic, respects reduced-motion |
| `src/lib/hooks/useLiveTick.ts` | minute-interval re-render for live durations |

### 6.4 Primitive library (`src/components/ui/`)

Shadcn-style primitives — all drop-in compatible with the pre-migration API:

Button, Input, Textarea, Label, Badge, Modal (wraps Dialog), Select, FilterSelect, PasswordInput, Skeleton, Spinner, Logo, Breadcrumbs, EmptyState, ConfirmDialog, Card, Dialog, DropdownMenu, Popover, Tabs (with fade-in on active), Tooltip, Avatar, Checkbox, Switch, Separator, Sheet, Alert, AlertDialog, Progress, ScrollArea, Table, Toast, PageHeader, ThemeToggle, LiveDot, StatCardsGrid.

### 6.5 Widget libraries (`src/components/<domain>/`)

Grouped by domain — each page is composed from these:

- `dashboard/` — TodayHero, TeamPulseStrip, WhoIsWorking, TopProjects, QuickActions
- `task/` — TaskToolbar, TaskStatStrip, TaskListView, TaskBoard (cross-project kanban), TaskKanban
- `taskupdate/` — TaskUpdateToolbar, TaskUpdateStatStrip, MissingSubmittersList, SubmittedUpdateCard
- `admin/` — UsersToolbar, UserStatStrip, RoleDropdown, UserActionsMenu
- `project/` — ProjectsToolbar, ProjectStatStrip, ProjectActionsMenu, ProjectListRow, ProjectHeader, ProjectDetailStatStrip, ProjectHealthCard, ProjectTaskBreakdown, TeamContribution, ProjectUpcomingDeadlines, ProjectCard
- `reports/` — ReportsPeriodNav, ReportsStatStrip
- `attendance/` — AttendanceMonthNav, MemberAttendanceCard, MemberAttendanceDrawer (centered Dialog), WeeklyLeaderboard
- `dayoff/` — DayOffCreateDialog
- `profile/` — ProfileEditDialog, ChangePasswordDialog, DesktopAppCard
- `settings/` — ColorField, BrandingPreview, TerminologyPanel, FeaturesPanel

### 6.6 Page map

| Path | Who sees it | Purpose |
|---|---|---|
| `(auth)/login` | Everyone | Workspace code + email + password (SRP) |
| `(auth)/signup` | Everyone | Two-phase org + owner creation |
| `(auth)/invite` | Invite link holders | Accept invite, set password |
| `(dashboard)/` | All authed | Role-based: admin/owner see `AdminDashboard`, members see `MemberDashboard` |
| `(dashboard)/my-tasks` | All authed | Personal + cross-project kanban/list view |
| `(dashboard)/projects` | All authed | Projects index |
| `(dashboard)/projects/[id]` | Project members | Detail — overview, tasks, reports, team |
| `(dashboard)/task-updates` | ADMIN/OWNER | Daily work summaries with missing-submitter tracking |
| `(dashboard)/admin/users` | ADMIN/OWNER | User list, roles, invites |
| `(dashboard)/attendance` | All authed | Person-first month grid + detail modal + weekly leaderboard |
| `(dashboard)/reports` | ADMIN/OWNER | Cross-project time reports, period nav |
| `(dashboard)/day-offs` | All authed | Submit + approve leave requests |
| `(dashboard)/profile` | All authed | Edit profile + change password |
| `(dashboard)/settings/organization` | OWNER | Branding, terminology, features, per-tenant config |

---

## 7. Auth + RBAC

Two role layers:

- **System roles** (workspace-wide): `OWNER`, `ADMIN`, `MEMBER`. Stored on the user record, mirrored to `custom:systemRole` JWT claim but always re-validated from DynamoDB in `extract_auth_context`.
- **Project roles** (per-project membership): `OWNER`, `MANAGER`, `MEMBER`, `VIEWER`. Stored on `PROJECT#{pid}#MEMBER#{uid}` items.

Authorization checks live in the `application/` layer of each context, never in handlers. See **[../architecture/RBAC-DOCUMENTATION.md](../architecture/RBAC-DOCUMENTATION.md)** for the full permission matrix.

---

## 8. Timer architecture

The timer is **migrating from web to desktop-only.** Both surfaces run today, but the plan is to remove the web timer once desktop reaches full feature parity. **Do not add web-only timer features without flagging this.** Full state machine in **[../architecture/TIMER-ARCHITECTURE.md](../architecture/TIMER-ARCHITECTURE.md)**.

---

## 9. What we just shipped (this session's migration)

The whole frontend got rebuilt on shadcn/ui. Every page was restructured. Highlights:

- **Design system foundation**: shadcn primitives, tokenized theme, multi-tenant CSS var branding preserved.
- **Shared cross-page primitives**: `StatCardsGrid` (with count-up + stagger + hover-lift), `PageHeader`, `LiveDot` (green "online now" indicator), `Tabs` with fade-in, `Progress` with animated fill.
- **Page restructures** (each one proposed → approved → implemented):
  - Dashboard (admin + member variants)
  - My Tasks (toolbar with search/sort/priority/assignee/overdue/scope/view switcher + list/board)
  - Projects index + detail (new ProjectHeader with domain accent strip + overall progress + member stack)
  - Task Updates (date pager + tabs with badges + missing submitters + email copy)
  - Admin Users (scope toggle, inline role change, ⋯ actions menu)
  - Attendance (person-first redesign: member cards + modal drawer + weekly leaderboard)
  - Reports (period nav + stat strip + weekly summary)
  - Day-offs (Create dialog with toggle buttons)
  - Profile (unified Edit modal w/ tabs + unified ChangePassword state machine)
  - Settings/Organization (shadcn Tabs + dirty tracking + sticky save bar + live branding preview)
- **Animation system**: `useCountUp`, stagger-up CSS, tab fade-in, hover-lift, `prefers-reduced-motion` safe.
- **Bugfixes**:
  - Hook-order violation in `AttendanceButton`.
  - Button-in-button hydration error in `ProjectReport`.
  - `UserSelect` couldn't open inside Radix Dialog → rewritten with Radix Popover.
  - "Invalid Date" crash on missing `task.deadline` → added `safeDeadlineLabel()`.
  - Bulk token migration glue-bug (`bg-cardrounded-xl`) → `fix-bg-card.js` patched 146 cases.
  - Department filter was scope-filtered → now derived from all non-OWNER users.
  - "2 members" dashboard bug: OWNER was counted → filtered out.

Full trail of what shipped per phase is in **[../saas/SAAS-CHANGES.md](../saas/SAAS-CHANGES.md)**.

---

## 10. What's still to do

### SaaS migration (tracked in [../saas/SAAS-MIGRATION.md](../saas/SAAS-MIGRATION.md) + [../saas/SAAS-PROGRESS.md](../saas/SAAS-PROGRESS.md))

- **Phase 3 remaining**: locale tab + leave-types tab on Settings (deferred).
- Phase 4+ scope — see ../saas/SAAS-MIGRATION.md.

### Color scheme change (interrupted mid-task)

User picked "Deep navy + slate" but pivoted to animations. Resuming means flipping tokens in `globals.css` + sweeping hardcoded indigo/violet references.

### Desktop app P0 security issues

**[../bug-reports/Bug-Report-Go.md](../bug-reports/Bug-Report-Go.md) lists 10 critical vulnerabilities** — blockers before wider rollout:
- Unsigned updater binary
- DPAPI fallback to plaintext credential storage
- Path traversal in update unpack
- ...and 7 more. Read the full report.

### Backend test coverage

Only ~2 test files in `backend/tests/` today. **No integration tests, no tenant-isolation tests.** Anything new should come with tests; ideally we also backfill tenant-boundary tests for every repository.

### Other known work

- Chat feature (planned — see `../planning/CHAT-FEATURE-PLAN.md`)
- CI pipeline (planned — see `../planning/CI-PIPELINE-PLAN.md`)
- Cross-platform desktop builds (planned — see `../desktop/CROSS-PLATFORM-PLAN.md`)
- Welcome email OTP flow (planned — see `../planning/WELCOME-EMAIL-OTP-PLAN.md`)

---

## 11. Gotchas — the stuff that will bite you if you don't know

1. **Never deploy prod without staging verification.** Ever.
2. **Never edit `app.py` to add staging knobs** — use `app_staging.py`.
3. **All key construction goes through `tenant_keys.py`.** String-formatting a PK inline is a review blocker.
4. **Aggregate list keys are forbidden** (`ORG#{id}#USER#LIST` etc.) — they create hot partitions.
5. **Two-phase signup with rollback** — if DynamoDB step fails, call `admin_delete_user` to avoid orphan Cognito users.
6. **Secrets go in Secrets Manager**, not env vars. Names: `taskflow/gmail-credentials`, `taskflow/groq-api-key` (staging prefix: `taskflow-staging/...`).
7. **`get_current_org_id()` returns `DEFAULT_ORG_ID` when called outside a request context** (cold start, pre-auth handlers). Pre-auth handlers that legitimately need a tenant (signup, `get_org_by_slug`, `resolve_employee`) must pass `org_id` explicitly to the repository constructor.
8. **Desktop config is build-time via `-ldflags`** — editing `config.json` at runtime does nothing.
9. **Backfill script `backend/scripts/backfill_neurostack.py` is idempotent** (always uses `attribute_not_exists(PK) AND attribute_not_exists(SK)`). Always run with `--dry-run` first, always against staging before prod.
10. **Domain `ruff` line length = 100** (`backend/pyproject.toml`). Enforced in CI.
11. **All animations must respect `prefers-reduced-motion`.** LiveDot has a `static` variant for this.
12. **Never hardcode brand colors** in components. Use semantic tokens (`bg-primary`, `text-primary-foreground`) so tenant branding works.
13. **Prod has live users.** ALL SaaS migration work stays on staging. Do not run any prod-touching action until explicitly told "cut over to prod".

---

## 12. Files to bookmark on day one

| File | Why |
|---|---|
| [../../CLAUDE.md](../../CLAUDE.md) | Project conventions, commands, deploy rules |
| [../saas/SAAS-MIGRATION.md](../saas/SAAS-MIGRATION.md) | Full multi-tenant conversion plan |
| [../saas/SAAS-CHANGES.md](../saas/SAAS-CHANGES.md) | What each phase actually shipped |
| [../saas/SAAS-PROGRESS.md](../saas/SAAS-PROGRESS.md) | Current state snapshot |
| [../api/API.md](../api/API.md) | Endpoint reference |
| [../../backend/src/shared_kernel/tenant_keys.py](../../backend/src/shared_kernel/tenant_keys.py) | All DynamoDB key construction |
| [../../backend/src/shared_kernel/auth_context.py](../../backend/src/shared_kernel/auth_context.py) | Every authed request starts here |
| [../../backend/cdk/stack.py](../../backend/cdk/stack.py) | Routes + Lambdas wiring |
| [../../frontend/src/app/globals.css](../../frontend/src/app/globals.css) | Theme tokens + animations |
| [../../frontend/tailwind.config.ts](../../frontend/tailwind.config.ts) | Semantic tokens + tenant RGB |
| [../../frontend/src/components/ui/StatCardsGrid.tsx](../../frontend/src/components/ui/StatCardsGrid.tsx) | Pattern for animated stat cards used everywhere |
| [../../frontend/src/lib/tenant/](../../frontend/src/lib/tenant/) | Workspace resolver + branding |
| [../architecture/RBAC-DOCUMENTATION.md](../architecture/RBAC-DOCUMENTATION.md) | Permission matrix |
| [../architecture/TIMER-ARCHITECTURE.md](../architecture/TIMER-ARCHITECTURE.md) | Timer state machine across web + desktop |
| [../architecture/PLAN-LIMITS.md](../architecture/PLAN-LIMITS.md) | Plan tiers, capacity caps, feature gating |
| [FEATURE-DEVELOPMENT-GUIDE.md](FEATURE-DEVELOPMENT-GUIDE.md) | How to add a feature end-to-end |
| [../bug-reports/Bug-Report-Go.md](../bug-reports/Bug-Report-Go.md) | Desktop P0 security issues |

---

## 13. Your first week checklist

- [ ] Read this file end-to-end.
- [ ] Read [../../CLAUDE.md](../../CLAUDE.md) and [../saas/SAAS-MIGRATION.md](../saas/SAAS-MIGRATION.md).
- [ ] Get AWS staging access (personal-account default profile).
- [ ] Run `cdk deploy --app "python app_staging.py"` against staging and verify `backend/output.json` fills in.
- [ ] Point your `frontend/.env.local` at staging and `npm run dev`.
- [ ] Sign up a fresh workspace end-to-end — signup → login → create project → create task → timer → daily update → day-off request.
- [ ] Pick one endpoint in `backend/src/contexts/` and trace it top-to-bottom: route in `stack.py` → handler → use case → repository → DynamoDB.
- [ ] Pick one page in `frontend/src/app/(dashboard)/` and trace it: page → widget components → React Query hook → API wrapper → endpoint.
- [ ] Open the desktop app in `wails dev`, sign in, run the timer, confirm the daily update syncs.
- [ ] Skim [../bug-reports/Bug-Report-Go.md](../bug-reports/Bug-Report-Go.md) and [../bug-reports/Bug-Report-Go-v2.md](../bug-reports/Bug-Report-Go-v2.md) — know what's unfixed on desktop.

Ask questions early. Welcome aboard.
