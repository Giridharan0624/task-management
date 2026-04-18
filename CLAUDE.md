# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three deployable units in one monorepo:

- `backend/` — Python 3.12 AWS Lambda monolith behind API Gateway, deployed with AWS CDK. Single DynamoDB table + Cognito + S3/CloudFront + Secrets Manager.
- `frontend/` — Next.js 16 (App Router) web app deployed to Vercel. Uses `amazon-cognito-identity-js` (SRP) for auth and React Query for state.
- `desktop/` — Go 1.22 + Wails v2 + Preact companion app (Windows/Linux/macOS) for timer, activity counters, and screenshots. Talks to the same API with a Cognito token.

Top-level `SAAS-MIGRATION.md` and `SAAS-CHANGES.md` describe the multi-tenant conversion currently on the `saas-migration` branch; read them before touching anything under `contexts/org/` or `shared_kernel/tenant_keys.py`.

## Common commands

### Backend (run from `backend/`)

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest                                    # all tests (pytest.ini: testpaths=tests, pythonpath=src)
pytest tests/test_domain_user.py -k create  # single test
```

CDK lives in `backend/cdk/`:

```bash
cd backend/cdk
cdk bootstrap                             # first time only
cdk deploy                                # PROD via app.py — uses --profile company
cdk deploy --app "python app_staging.py"  # STAGING — default (personal) AWS profile
cdk deploy --app "python app_company.py"  # NEUROSTACK prod tenant with custom domain
```

Deployment profile convention (do not deviate):

- Staging → default AWS profile (personal account); entry point `app_staging.py`.
- Prod → `--profile company`; entry point `app.py` or `app_company.py`.
- Never deploy to prod without first verifying end-to-end on staging.
- Never edit `app.py` to add staging-only knobs; add them to `app_staging.py`.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev        # next dev (localhost:3000)
npm run build      # production build
npm run lint       # next lint
```

Env file `frontend/.env.local` must define `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_AWS_REGION=ap-south-1`. Values come from the CDK stack outputs (`backend/output.json`).

### Desktop (run from `desktop/`)

```bash
wails dev                # development run
make check               # cross-compile for windows+linux without Wails frontend
make windows             # build .exe with ldflags baked in
powershell -File build-installer-staging.ps1  # NSIS installer (staging config)
powershell -File build-installer.ps1          # NSIS installer (prod default)
```

Config values (API URL, Cognito IDs, dashboard URL, version) are injected at build time via `-ldflags` — see `desktop/Makefile`. They are not read from disk, so updating `config.json` alone will not change runtime behavior.

## Architecture

### Backend — DDD bounded contexts on a single Lambda stack

Each bounded context in [backend/src/contexts/](backend/src/contexts/) has the same four-layer split: `domain/` (entities, value objects, repo interfaces), `application/` (use cases + authorization), `infrastructure/` (DynamoDB repo, mappers, external services), `handlers/` (Lambda entry points). Contexts: `user`, `project`, `task`, `comment`, `attendance`, `dayoff`, `taskupdate`, `activity`, `upload`, `org`.

CDK [backend/cdk/stack.py](backend/cdk/stack.py) wires every handler module to an API Gateway route and a dedicated Lambda. The stack is parameterized by a `stage_config` dict (table name, Cognito pool name, CORS origins, Gmail/Groq secret names, etc.) passed from the app entry point. There are ~32 Lambdas and ~51 routes; adding a new endpoint means both a new handler module *and* a new route binding in `stack.py`.

Every authenticated handler starts with:

```python
auth = extract_auth_context(event)   # shared_kernel/auth_context.py
```

`extract_auth_context` reads `sub`, `email`, `custom:orgId`, `custom:systemRole` from the JWT, then re-reads the authoritative `system_role` from DynamoDB so role changes take effect without re-login. It also stamps `org_id` into a `ContextVar` so repositories instantiated later in the request automatically scope their reads/writes — handlers do not thread `org_id` through every call site.

Request/response helpers live in `shared_kernel/`:
- `validate_body(Model, event["body"])` — Pydantic parse with JSON error handling
- `build_success(status, data)` / `build_error(exception)` — CORS headers + envelope
- `errors.py` — shared exception classes that `build_error` maps to HTTP codes
- `dynamo_client.get_table()` — single `boto3` resource reused across repos

### Multi-tenant DynamoDB schema

One table, one Cognito pool, one S3 bucket, with `org_id` prefixed into every non-global key. **All key construction goes through [backend/src/shared_kernel/tenant_keys.py](backend/src/shared_kernel/tenant_keys.py)** — repositories must not string-format PKs inline.

Shape:

```
PK=ORG#{org}#USER#{userId}         SK=PROFILE
PK=ORG#{org}#PROJECT#{pid}         SK=METADATA | MEMBER#{uid} | TASK#{tid}
PK=ORG#{org}                       SK=ORG | SETTINGS | PLAN | ROLE#{id} | PIPELINE#{id} | INVITE#{token}
PK=SLUG#{slug}                     SK=ORG                       # workspace-code → org_id (global)
GSI1PK=USER_EMAIL#{email}                                       # email globally unique
GSI2PK=ORG#{org}#EMPLOYEE#{eid}                                  # employee IDs are per-tenant
```

`DEFAULT_ORG_ID = "neurostack"` is the fallback when a legacy token has no `custom:orgId` claim. Phase 1 completed dual-write + read cutover (see recent commits `refactor(step 10a/10b)`); new code should only emit v2 keys.

### S3 object keys

All uploads are keyed `orgs/{orgId}/{userId}/{filename}`. The presign handler reads `orgId` from `AuthContext` and refuses any key outside the tenant's prefix — tenant isolation is enforced at presign time, not just via bucket policy.

### Cognito auth flow

SRP authentication (password never leaves the browser). The ID token carries `custom:orgId` and `custom:systemRole`, injected by a pre-token-generation Lambda ([backend/src/contexts/org/handlers/pre_token_trigger.py](backend/src/contexts/org/handlers/pre_token_trigger.py)). Login UI asks for workspace code + email + password; the workspace code is used purely to theme the login screen and validate that `custom:orgId` matches — it is not part of the credential.

### Frontend shape

`frontend/src/app/` uses Next.js App Router route groups: `(auth)` for login/signup, `(dashboard)` for authenticated pages. `frontend/src/lib/api/` is a per-resource API client thin layer on `fetch`; `frontend/src/lib/hooks/` wraps each call in a React Query hook. `frontend/src/lib/tenant/` and `frontend/src/components/tenant/` hold the workspace-code resolver, tenant context, and branding overrides for the SaaS migration.

### Desktop shape

Go backend in `desktop/internal/` is split by concern: `auth/` (Cognito SRP + OS credential storage), `api/` (HTTP client with TLS 1.3 floor), `monitor/` (activity counters, screenshots, notifications — only active while the timer is on), `tray/` (Win32/X11/AppKit system tray), `updater/` (GitHub releases check). Preact UI in `desktop/frontend/`.

The timer is migrating from web to desktop-only — both surfaces run today, but the plan is to remove the web timer once the desktop app reaches full feature parity. Do not add new web-only timer features without flagging this.

## Conventions and gotchas

- `get_current_org_id()` returns `DEFAULT_ORG_ID` when called outside a request context (cold start, pre-auth handlers). Pre-auth handlers that legitimately need to act for a specific tenant (signup, `get_org_by_slug`, `resolve_employee`) must pass `org_id` explicitly to the repository constructor.
- Signup is two-phase: `admin_create_user` in Cognito, then `TransactWriteItems` for org/settings/first-user. If the DynamoDB step fails, roll back with `admin_delete_user` — otherwise the Cognito user orphans.
- Aggregate list keys (`ORG#{id}#USER#LIST` etc.) are forbidden — they create hot partitions. Use scoped PK queries.
- Gmail SMTP and Groq API keys live in Secrets Manager (`taskflow/gmail-credentials`, `taskflow/groq-api-key`; staging prefix `taskflow-staging/...`). Do not embed them in env vars.
- Backfill script [backend/scripts/backfill_neurostack.py](backend/scripts/backfill_neurostack.py) is idempotent and non-destructive (always honors `attribute_not_exists(PK) AND attribute_not_exists(SK)`); run `--dry-run` first, always against staging before prod.
- Domain ruff line length is 100 (`backend/pyproject.toml`).

## Documentation worth reading before larger changes

- [SAAS-MIGRATION.md](SAAS-MIGRATION.md) — full phased plan for the multi-tenant conversion
- [SAAS-CHANGES.md](SAAS-CHANGES.md) — running log of what each phase actually shipped
- [docs/RBAC-DOCUMENTATION.md](docs/RBAC-DOCUMENTATION.md) — system roles vs. project roles, permission matrix
- [docs/TIMER-ARCHITECTURE.md](docs/TIMER-ARCHITECTURE.md) — timer state machine across web + desktop
- [backend/API.md](backend/API.md) — endpoint reference
