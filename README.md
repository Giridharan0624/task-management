# TaskFlow

**Multi-tenant SaaS for team task management, attendance, and activity monitoring.**

Any organization signs up at `taskflow.neurostack.in/signup`, picks a workspace code, and gets an isolated tenant with configurable branding, roles, pipelines, terminology, and feature toggles. Full web dashboard plus a Windows/Linux/macOS desktop companion for timer + activity capture.

📄 [PRD](PRD.md) · [TDD](TDD.md) · [Shipped vs. not](SAAS-STATUS.md) · [Conventions](CLAUDE.md)

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
| **Auth** | Cognito SRP, email+password, 8+ char password policy, SDK-based email-verification challenge |
| **Invites** | Single-use 7-day tokens, email via Gmail SMTP, accept flow sets own password |
| **Roles & permissions** | 35-permission catalog, per-org role records, matrix editor UI, cache invalidation on edit |
| **Projects & tasks** | Per-org pipelines (named, ordered, colored statuses), kanban + list views, comments, attachments |
| **Attendance & timer** | Live timer (web + desktop), task switching, meeting mode, mandatory descriptions |
| **Activity monitoring** | Desktop keyboard/mouse counts + screenshots (opt-in per tenant via feature flag) |
| **Day-offs** | Request/approve/reject, per-org leave types, self-approval blocked |
| **Reports** | Summary/detailed/weekly/activity, Recharts + CSV export, AI summaries via Groq |
| **Branding** | Per-org colors (CSS vars), logo + favicon, terminology overrides (`useT()` hook) |
| **Ownership** | OWNER-only transfer with typed-email confirmation + forced token refresh |
| **Suspension** | Platform-operator env-allowlist endpoint + fullscreen SuspendedScreen |
| **Audit log** | Every sensitive mutation written to `PK=ORG#{org}#AUDIT` |

### Platform
| Area | What ships |
|---|---|
| **Observability** | 5 CloudWatch alarms (5xx rate, 4xx spike, p95 latency, DDB user errors, DDB throttles), Sentry scaffold (dormant until DSN) |
| **Rate limiting** | WAFv2 regional ACL — per-workspace header + per-IP + per-IP-signup |
| **Data protection** | DynamoDB PITR (7d staging / 35d prod), S3 encryption, presigned uploads scoped to `orgs/{orgId}/` |
| **CI** | GitHub Actions: backend pytest + frontend lint/build, path-filtered |
| **Scheduled jobs** | Nightly retention sweeper, seat reconciliation, daily AI summaries, 5-min stale session sweeper |
| **Plans** | FREE (10u/3p/30d), PRO (50u/50p/365d), ENTERPRISE (unlimited). Enforced at create sites. |

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
├── SAAS-STATUS.md       Current state vs. P0/P1/P2 roadmap
├── SAAS-MIGRATION.md    Original phased migration plan
├── SAAS-PROGRESS.md     Running log of shipped changes
├── CLAUDE.md            Authoritative codebase conventions
└── docs/                Per-feature docs (RBAC, timer, API, migrations)
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
pytest                                    # 33 tests

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
| `platform_admin_user_ids` | CDK stage config | Comma-separated Cognito subs allowed to call `POST /platform/orgs/{orgId}/status` (suspension). Empty = nobody (fail-closed). |
| `hcaptcha_secret` | CDK stage config | Enables server-side hCaptcha verify on signup |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | Vercel | Renders the hCaptcha widget on the signup form |
| `SENTRY_DSN` | Lambda env | Activates backend Sentry (requires `sentry-sdk[aws_lambda]` in deps layer) |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | Activates frontend Sentry (requires `npm install @sentry/browser`) |

---

## Data model (single table)

| Entity | PK | SK |
|---|---|---|
| Organization | `ORG#{org}` | `ORG` |
| Org settings | `ORG#{org}` | `SETTINGS` |
| Org plan | `ORG#{org}` | `PLAN` |
| Role | `ORG#{org}` | `ROLE#{role_id}` |
| Pipeline | `ORG#{org}` | `PIPELINE#{pipeline_id}` |
| Invite | `ORG#{org}` | `INVITE#{token}` |
| User | `ORG#{org}#USER#{userId}` | `PROFILE` |
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

| Environment | API | Web | AWS profile | CDK entry |
|---|---|---|---|---|
| **Staging** | `4saz9agwdi.execute-api.ap-south-1.amazonaws.com/staging/` | `localhost:3000` / Vercel preview | default (personal) | `app_staging.py` |
| **Production** | (company account) | `taskflow.neurostack.in` | `company` | `app.py` / `app_company.py` |

Deployment rule (from `CLAUDE.md`): **no prod deploy until the full change is verified end-to-end on staging.** All SaaS-migration work is on staging only until the cutover ticket opens.

---

## Status

P0 SaaS substrate is **functionally complete on staging**. See [SAAS-STATUS.md](SAAS-STATUS.md) for the live checklist.

The only remaining P0-adjacent gates before prod cutover are:
1. Prod backfill rehearsal
2. Org-deletion design pass

P1 backlog (desktop code-signing, macOS build, 2FA, SES, bulk CSV import, `ProjectRole` refactor) is deliberately not being worked until tenant feedback forces priority.

---

## License & ownership

Developed by **Giridharan S** at **NEUROSTACK**.
Copyright © 2026 NEUROSTACK. All rights reserved.
