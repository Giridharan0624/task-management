# TaskFlow

**Multi-tenant SaaS for team task management, attendance, and activity monitoring.**

Any organization signs up at `taskflow.neurostack.in/signup`, picks a workspace code, and gets an isolated tenant with configurable branding, roles, pipelines, terminology, and feature toggles. Full web dashboard plus a Windows/Linux/macOS desktop companion for timer + activity capture.

📄 [PRD](PRD.md) · [TDD](TDD.md) · [Shipped vs. not](docs/saas/SAAS-STATUS.md) · [Conventions](CLAUDE.md) · [Docs index](docs/README.md)

---

## Architecture

```
           ┌─────────────────────────────────────────────────┐
           │              AWS (ap-south-1)                   │
           │                                                 │
 ┌──────┐  │  ┌─────┐   ┌───────────────────────────┐       │   ┌──────────┐
 │ Web  │──┼──│ API │───│ Lambda (~50 fn, parent +  │       │   │ Desktop  │
 │Next  │  │  │ GW  │   │   Org + Workflow nested)  │       │───│ Wails v2 │
 │Vercel│──┼──│REST │───│ Python 3.12 + DDD          │       │   │ Go+Preact│
 └──────┘  │  └─┬───┘   └──┬──────┬───────┬─────────┘       │   └──────────┘
           │    │ WAFv2    │      │       │                  │
           │  ┌─┴──────┐ ┌─▼────┐ │  ┌────▼────┐             │
           │  │Cognito │ │DynamoDB│ │  │ S3 +    │             │
           │  │(pooled)│ │1 table │ │  │ CDN     │             │
           │  │+PreTok │ │+2 GSI  │ │  │         │             │
           │  │ trigger│ │ PITR   │ │  │         │             │
           │  └────────┘ └────────┘ │  └─────────┘             │
           │                        │                          │
           │  ┌──────────┐   ┌──────▼──────┐  ┌──────────┐     │
           │  │ CWatch   │   │ Secrets Mgr │  │ Groq AI  │     │
           │  │ 5 alarms │   │ Gmail, Groq │  │ summaries│     │
           │  └──────────┘   └─────────────┘  └──────────┘     │
           └─────────────────────────────────────────────────┘
```

See [TDD.md](TDD.md) for the full system design.

---

## Multi-tenancy at a glance

- **Pooled isolation**: one DynamoDB table, one Cognito pool, one S3 bucket. Every tenant-scoped PK prefixes `ORG#{org_id}#`.
- **No per-tenant subdomains**: login is email + password; workspace is resolved from the JWT's `custom:orgId` claim.
- **Auto-scoped repos**: `AuthContext.org_id` stamps a ContextVar; every repo instantiated later in the request is scoped to the right tenant automatically.
- **CI gate**: [backend/tests/test_multitenancy.py](backend/tests/test_multitenancy.py) asserts cross-tenant reads return empty even with handcrafted PKs.

---

## Features

### Product
| Area | What ships |
|---|---|
| **Tenant signup** | Slug claim, two-phase Cognito + DynamoDB create with rollback, hCaptcha (optional), email-verification gate |
| **Auth** | Cognito SRP, email+password, 8+ char password policy, SDK email-verification challenge, **TOTP 2FA** (enroll/verify/disable + OWNER reset path), **self-service email change** |
| **Invites** | Single-use 7-day tokens, email via Gmail SMTP, accept flow sets own password, **bulk CSV import** |
| **Roles & permissions** | 35-permission catalog, per-org role records (both `scope="system"` and `scope="project"`), matrix editor UI, cache invalidation on edit |
| **Projects & tasks** | Per-org pipelines (named, ordered, colored statuses), kanban + list views, comments, attachments |
| **Attendance & timer** | Live timer (web + desktop), task switching, meeting mode, mandatory descriptions |
| **Activity monitoring** | Desktop keyboard/mouse counts + screenshots (opt-in per tenant via feature flag) |
| **Day-offs** | Request/approve/reject, per-org leave types, self-approval blocked |
| **Reports** | Summary/detailed/weekly/activity, Recharts + CSV export, AI summaries via Groq (**PRO-tier**), **weekly AI-rollup digest** (PRO-tier) that pulls task updates + attendance + activity + day-offs into one editorial recap |
| **Project Reports tab** | Inner tabs (Overview / Workload / Sessions), consolidated period+navigator+export toolbar, pixel-grid metric strip, donut without tooltip-collision |
| **Activity score** | Composite `0.7 × presence + 0.3 × intensity` formula — punishes wiggle-farming, caps power-typists at 1.0, fed directly into the AI summary prompt |
| **Branding & theming** | Per-org **5-up curated theme picker** (light + dark palettes per preset), **curated font picker** (7 professional sans-serifs), logo + favicon, terminology overrides (`useT()` hook), **locale-bound date/number/currency formatters** (`useFormat()` hook) |
| **Departments** | OWNER-managed department catalog under Settings → Organization → Departments. Drives the dropdown on the user create form and the filter on the admin Users page; rename/reorder/delete inline with one-click "Restore defaults" |
| **Integrations** | Pluggable connector platform (PRO-tier) with a Freshworks (Freshdesk + Freshservice) connector shipping today. HMAC-signed inbound webhooks, KMS-encrypted credentials, idempotent event ingestion, normalized field mapping into TaskFlow tasks |
| **Onboarding** | Server-persisted first-run checklist on the OWNER dashboard; dismissal + per-step ticks live in `OrgSettings.features` so they survive across browsers; branding step ticks on theme/font/color customization |
| **Marketing** | Glass-morphism landing; 3-tier pricing card (Free/Pro/Enterprise) with honest "Soon" tags on aspirational items; AI bullet correctly placed under Pro; legal/security/status/download pages |
| **Ownership** | OWNER-only transfer with typed-email confirmation + forced token refresh |
| **Suspension** | Platform-operator env-allowlist endpoint + fullscreen SuspendedScreen |
| **Deletion** | OWNER-initiated soft-delete (30-day grace) + JSON export to S3 + nightly hard-delete sweeper |
| **Audit log** | Every sensitive mutation written to `PK=ORG#{org}#AUDIT`; viewer UI with friendly action labels + filters + pagination |
| **Notifications** | Per-user in-app partition; NotificationCenter bell polls every 30s; emitted on task assignment |
| **Webhooks** | Per-org subscriptions; HMAC-SHA256 Stripe-shape signing; `/settings/webhooks` CRUD UI |
| **Platform console** | `/platform` (env-gated) — slug lookup, suspend/unsuspend, per-tenant feature-flag toggles |

### Platform
| Area | What ships |
|---|---|
| **Observability** | 5 CloudWatch alarms (5xx rate, 4xx spike, p95 latency, DDB user errors, DDB throttles), Sentry scaffold (dormant until DSN) |
| **Rate limiting** | WAFv2 regional ACL — per-workspace header + per-IP + per-IP-signup |
| **Data protection** | DynamoDB PITR (7d staging / 35d prod), S3 encryption, presigned uploads scoped to `orgs/{orgId}/` |
| **CI** | GitHub Actions: backend pytest + frontend lint/build, path-filtered |
| **Scheduled jobs** | Nightly retention sweeper, seat reconciliation, daily AI summaries, 5-min stale session sweeper |
| **Plans** | FREE (10u/3p/30d), PRO (50u/50p/365d, +AI summaries +weekly rollup +screenshots +custom roles +custom pipelines +integrations +API access), ENTERPRISE (unlimited, +SSO/SAML +audit retention +white-label +custom domain). Capacity enforced at create sites + nightly seat reconciliation. **`require_feature()` now gates against `plan.features_allowed` first** (raises `PLAN_FEATURE_LOCKED`), then the OWNER's settings toggle (raises `FEATURE_DISABLED`); frontend `<FeatureGate>` mirrors both checks so PRO-only affordances hide on FREE plans. Full design in [docs/architecture/PLAN-LIMITS.md](docs/architecture/PLAN-LIMITS.md). |

---

## Repository layout

```
task-management/
├── backend/             Python 3.12 Lambda monolith + AWS CDK
│   ├── cdk/             Infrastructure-as-code (parent + 2 nested stacks)
│   ├── src/
│   │   ├── contexts/    DDD bounded contexts (user/project/task/org/...)
│   │   └── shared_kernel/   Cross-cutting (auth, tenant_keys, permissions, audit)
│   ├── tests/           pytest suite (includes multitenancy isolation contract)
│   └── scripts/         backfills (backfill_phase4_phase5.py, etc.)
│
├── frontend/            Next.js 16 web app (Vercel)
│   └── src/
│       ├── app/
│       │   ├── (auth)/          login, signup, invite/[token], verify-email
│       │   └── (dashboard)/     All authenticated pages + settings/*
│       ├── components/          UI + tenant + auth + domain components
│       ├── lib/                 api client, hooks, tenant + auth providers
│       └── types/               TS types
│
├── desktop/             (GITIGNORED — separate repo for Wails v2 + Go + Preact)
│
├── .github/workflows/   Backend + frontend CI
├── PRD.md               Product requirements (user-facing)
├── TDD.md               Technical design (engineer-facing)
├── CLAUDE.md            Authoritative codebase conventions
└── docs/
    ├── architecture/    Plan limits, RBAC, timer architecture
    ├── saas/            Multi-tenant migration plan, status, progress
    ├── guides/          Onboarding, demo script, deployment runbooks
    ├── desktop/         CI/CD, release-signing, cross-platform plan
    ├── planning/        UX backlog, feature proposals
    ├── api/             REST endpoint reference
    ├── reference/       Feature catalog, legacy PRD
    └── bug-reports/     Historical bug investigations
```

---

## Quickstart

### Prerequisites
- AWS CLI (two profiles: `default` for staging, `company` for prod)
- AWS CDK CLI (`npm install -g aws-cdk`)
- Python 3.12
- Node.js 20+

### Backend

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest                                    # 44 tests across 5 files

cd cdk
cdk deploy --app "python app_staging.py"  # staging (personal profile)
cdk deploy --app "python app.py" --profile company    # prod (NEUROSTACK)
```

CDK outputs API URL, Cognito User Pool + Client ID, table name.

### Frontend

```bash
cd frontend
npm install
npm run dev                               # localhost:3000
npm run build                             # production build
```

`.env.local`:
```env
NEXT_PUBLIC_API_URL=<from CDK output>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<from CDK output>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<from CDK output>
NEXT_PUBLIC_AWS_REGION=ap-south-1

# Optional — hCaptcha widget (signup)
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=

# Optional — Sentry (dynamic-imports @sentry/browser if present)
NEXT_PUBLIC_SENTRY_DSN=
```

### Operator flags (optional systems)

| Flag | Where | Effect |
|---|---|---|
| `platform_admin_user_ids` | CDK stage config | Comma-separated Cognito subs allowed to hit `/platform/orgs/{orgId}/status` (suspension) and `/platform/orgs/{orgId}/features` (feature-flag toggle). Empty = nobody (fail-closed). |
| `NEXT_PUBLIC_PLATFORM_ADMIN_USER_IDS` | Vercel | Must mirror the backend allowlist. Controls who sees the `/platform` frontend console. |
| `hcaptcha_secret` | CDK stage config | Enables server-side hCaptcha verify on signup |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Vercel | Renders the hCaptcha widget on the signup form |
| `SENTRY_DSN` | Lambda env | Activates backend Sentry (requires `sentry-sdk[aws_lambda]` in deps layer) |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | Activates frontend Sentry (requires `npm install @sentry/browser`) |
| `HARD_DELETE_GRACE_DAYS` | Lambda env (staging only) | Compresses the 30-day deletion grace period for rehearsal runs |

---

## Data model (single table)

| Entity | PK | SK |
|---|---|---|
| Organization | `ORG#{org}` | `ORG` |
| Org settings | `ORG#{org}` | `SETTINGS` |
| Org plan | `ORG#{org}` | `PLAN` |
| Role (system or project) | `ORG#{org}` | `ROLE#{role_id}` |
| Pipeline | `ORG#{org}` | `PIPELINE#{pipeline_id}` |
| Invite | `ORG#{org}` | `INVITE#{token}` |
| Webhook | `ORG#{org}` | `WEBHOOK#{webhook_id}` |
| User | `ORG#{org}#USER#{userId}` | `PROFILE` |
| Notification | `ORG#{org}#USER#{userId}` | `NOTIF#{ts}#{id}` |
| Project | `ORG#{org}#PROJECT#{pid}` | `METADATA` |
| Project member | `ORG#{org}#PROJECT#{pid}` | `MEMBER#{userId}` |
| Task | `ORG#{org}#PROJECT#{pid}` | `TASK#{taskId}` |
| Audit event | `ORG#{org}#AUDIT` | `EVENT#{ts}#{eventId}` |
| Slug resolver | `SLUG#{slug}` | `ORG` (global) |
| Invite-token lookup | `INVITE_TOKEN#{token}` | `LOOKUP` (global) |

**GSI1**: global email uniqueness (`GSI1PK=USER_EMAIL#{email}`)
**GSI2**: per-tenant employee ID lookup (`GSI2PK=ORG#{org}#EMPLOYEE#{eid}`)

Key construction is centralized in [backend/src/shared_kernel/tenant_keys.py](backend/src/shared_kernel/tenant_keys.py). Repositories never string-format PKs inline.

---

## Environments

| Environment | API | Web | AWS profile | CDK entry | Notes |
|---|---|---|---|---|---|
| **Staging (V2 — active)** | `4saz9agwdi.execute-api.ap-south-1.amazonaws.com/staging/` | `taskflow-ns.vercel.app` / `localhost:3000` | `company` | `app_staging.py` | All non-customer-facing development lands here. Has the integration platform. CORS includes the Vercel URL. |
| **Production V2** | `taskflow-v2` stack on company AWS | (Vercel) | `company` | `app_company_v2.py` | Where new features promote after staging verification. Has the integration platform. |
| **Production (legacy)** | `taskflow` stack on company AWS | `taskflow.neurostack.in` | `company` | `app.py` / `app_company.py` | Hosts live customers. **Do not touch** until explicit cutover authorization — see `no-touch-legacy-taskflow` in CLAUDE.md memory. |

Personal-account staging stack was destroyed 2026-04-30. Promotion path: `taskflow-v2` → (verify) → legacy prod cutover, gated by explicit user authorization. Deployment rule (from `CLAUDE.md`): **no prod deploy until the full change is verified end-to-end on V2.**

---

## Status

P0 + most of P1 is **functionally complete on V2** after 9 post-phase sessions. See [docs/saas/SAAS-STATUS.md](docs/saas/SAAS-STATUS.md) for the live checklist.

Shipped across Sessions 1–8: 2FA TOTP, 30-day deletion lifecycle with export + sweeper, change-email, bulk CSV import, `ProjectRole` → per-org roles refactor, in-app notifications, outbound webhooks, platform operator console, audit log viewer UI, i18n foundation, CI/CD, Sentry scaffold, CAPTCHA on signup, health check, ownership transfer UI, suspension, composite activity score, weekly AI rollup with multi-source enrichment, glass landing redesign, 3-tier pricing card, server-persisted onboarding checklist, restructured Project Reports tab.

Shipped in Session 9 (2026-04-25 → 2026-04-30):
- **Integration platform** — pluggable connector framework + Freshworks (Freshdesk + Freshservice) connector live on V2; HMAC-signed webhooks, KMS-encrypted credentials, idempotent ingestion, 8 contract/connector tests; deployed via the new `IntegrationsNestedStack`
- **AI features migrated to PRO** — `ai_summaries` moved out of `FREE_FEATURES`; `require_feature()` now checks `plan.features_allowed` first and raises `PLAN_FEATURE_LOCKED`; weekly rollup handler newly gated; frontend `<FeatureGate>` and `<FeaturesPanel>` reflect plan + settings together
- **Theme picker + font picker** — 5 curated theme presets (`OrgSettings.theme`) and 7 professional sans-serif typefaces (`OrgSettings.fontFamily`) replace the old standalone color swatches in Settings → Branding
- **Departments catalog** — OWNER-managed `OrgSettings.departments` list drives the user create form + admin filter; full CRUD UI under Settings → Organization → Departments
- **V2 cutover** — `taskflow-v2` is now the active deploy target; personal-account staging stack destroyed 2026-04-30; `taskflow-ns.vercel.app` is the Vercel front-end URL with CORS allowed in V2 staging
- **Settings nav rename** — "Danger zone" → "Workspace controls", muted-grey link colors corrected to match the rest of the nav
- **Responsive overhaul** — Dialog/Modal mobile gutters, Sheet drawer width on phones, table `overflow-x-auto` wrappers on every wide table (day-offs, reports, bulk import, time-report sessions), Toast width clamping, leaderboard column compression, TodayHero alert-chip wrap layout
- **Operational** — `force_signout_all.py` script for cleaning stuck attendance sessions; lint script swapped from removed `next lint` to `tsc --noEmit`; React 18 → 19 upgrade to match Next 16 hook semantics

The only remaining gates before legacy-prod cutover are operational:
1. **Prod backfill rehearsal** — dry-run `backfill_neurostack.py` against a company-account snapshot
2. **Cutover window** — CDK deploy to legacy `taskflow` stack + Vercel env swap

P1/P2 backlog (desktop code-signing, macOS build, SES, SSO/SAML, SCIM, custom-domain-per-tenant, Stripe billing, `shared_kernel/plan_limits.py` helper for the remaining declared-but-not-enforced flags, audit-log retention sweep, full i18n sweep) is deliberately waiting on tenant-driven priority.

---

## License & ownership

Developed by **Giridharan S** at **NEUROSTACK**.
Copyright © 2026 NEUROSTACK. All rights reserved.
