# What's Changing — Single-Tenant → Multi-Tenant SaaS

A side-by-side document of every behavior, file, and concept that changes when TaskFlow moves from a NEUROSTACK-internal tool to a multi-tenant SaaS. Use this as a change-log / diff reference. For the phased rollout plan, see [SAAS-MIGRATION.md](SAAS-MIGRATION.md).

---

## 1. Core concept changes

| Concept | Before (single-tenant) | After (multi-tenant SaaS) |
|---------|-----------------------|---------------------------|
| Tenant identity | None — data implicitly belongs to NEUROSTACK | Every row tagged with `org_id`; `Organization` is a first-class entity |
| URL | `taskflow-ns.vercel.app` | Single domain `taskflow.neurostack.in`; tenants disambiguated by workspace-code field on the login form |
| Signup | Admin manually creates users in AWS console | Public `POST /signup` creates Org + first OWNER |
| Adding users | Admin creates directly | OWNER sends email invite → user accepts |
| Roles | Hardcoded enum: OWNER / ADMIN / MEMBER | Tenant-defined roles + permission matrix (seeded with 3 defaults) |
| Task pipelines | Hardcoded: DEVELOPMENT / DESIGNING / MANAGEMENT / RESEARCH | Tenant-defined pipelines with custom statuses |
| Branding | Hardcoded "TaskFlow / NEUROSTACK" | Per-org logo, name, primary/accent colors |
| Terminology | Hardcoded strings ("Employee", "Task", "Project") | Per-org terminology overrides via i18n keys |
| Feature set | All features on, always | Per-org feature toggles (birthday wishes, screenshots, AI summaries, etc.) |
| Limits | Unlimited | Free / Pro / Enterprise plan limits enforced in code |
| Email uniqueness | Globally unique | Unique per tenant (same email can exist in two orgs) |
| Employee ID | Hardcoded `EMP-####` prefix | Per-org `company_prefix` (already modeled on User, finally wired) |
| Timezone / locale / currency | Not configurable | Per-org `OrgSettings` |
| Desktop app | Tenant baked in at build time via `-ldflags` | Workspace code prompted on first launch, saved locally; API URL still baked in (single shared API) |

---

## 2. Data model changes

### DynamoDB keys

**Before:**
```
PK=USER#{userId}          SK=PROFILE
PK=PROJECT#{projectId}    SK=META | TASK#{taskId}
GSI1PK=EMAIL#{email}
GSI2PK=EMPLOYEE#{employeeId}
```

**After:**
```
PK=ORG#{org}#USER#{userId}            SK=PROFILE
PK=ORG#{org}#PROJECT#{projectId}      SK=META | TASK#{taskId} | MEMBER#{userId}
PK=ORG#{org}                          SK=ORG | SETTINGS | PLAN
PK=ORG#{org}                          SK=ROLE#{roleId} | PIPELINE#{id} | INVITE#{token}
PK=SLUG#{slug}                        SK=ORG                    # new: workspace-code resolver
GSI1PK=ORG#{org}#EMAIL#{email}                                  # scoped per-tenant
GSI2PK=ORG#{org}#EMPLOYEE#{employeeId}                          # scoped per-tenant
```

### New entities
- `Organization` — slug, name, plan tier, status, created_at
- `OrgSettings` — branding, terminology, locale, features, leave types (one JSON doc per org)
- `Role` — org-scoped, name + permission set (replaces `SystemRole` / `ProjectRole` enums)
- `Pipeline` + `PipelineStatus` — replaces hardcoded domain→statuses map
- `Invite` — token-based, 7-day TTL
- `Plan` — tier + limits (max_users, max_projects, retention_days, features_allowed)

### Modified entities
- `User` — adds `org_id`, `role_id` (replaces `system_role` enum field); existing `company_prefix` finally used
- `Project` — adds `org_id`
- `Task` — adds `org_id`; `domain` field becomes `pipeline_id`; `status` becomes free-form string validated against pipeline
- `Attendance`, `DayOff`, `Comment`, `TaskUpdate`, `Activity` — all gain `org_id`

### S3 object keys
| Before | After |
|--------|-------|
| `{userId}/avatar.png` | `orgs/{orgId}/{userId}/avatar.png` |
| `screenshots/{userId}/{ts}.png` | `orgs/{orgId}/screenshots/{userId}/{ts}.png` |
| `taskflow-uploads-prod` bucket | Same bucket, prefix enforced at presign time |

---

## 3. Authentication & authorization changes

| Area | Before | After |
|------|--------|-------|
| Cognito custom attributes | `custom:employeeId` | `custom:employeeId`, `custom:orgId` (immutable), `custom:roleId`, `custom:systemRole` |
| Token generation | Standard Cognito flow | **New** pre-token-generation Lambda trigger injects `orgId` + `roleId` into every ID token |
| `AuthContext` (backend) | `{user_id, email, system_role}` | `{user_id, email, org_id, role_id}` |
| Role check | `if ctx.system_role not in PRIVILEGED_ROLES:` hardcoded check | `require(ctx, "task.delete")` permission-string helper |
| Email login alias | Cognito email alias (globally unique) | Dropped — login via `employeeId` or slug-scoped email |
| Role changes take effect | Immediately via DB read | Requires ID token refresh (`Amplify.refreshSession()` on role save) |

### Permission catalog (new)
~30 string constants in `backend/src/contexts/org/domain/permissions.py`:
```
task.create  task.delete  task.update.own  task.update.any  task.view
project.create  project.delete  project.edit  project.members.manage
user.invite  user.delete  user.view
settings.edit  role.manage  billing.view
attendance.sign_in  attendance.report.view
dayoff.request  dayoff.approve
activity.view  activity.export
```

---

## 4. Backend changes (file-by-file)

### New files
| File | Purpose |
|------|---------|
| `backend/src/contexts/org/domain/entities.py` | `Organization`, `OrgSettings`, `Invite`, `Plan` |
| `backend/src/contexts/org/domain/role.py` | `Role` with permission sets |
| `backend/src/contexts/org/domain/permissions.py` | Permission string constants |
| `backend/src/contexts/org/domain/default_roles.py` | OWNER/ADMIN/MEMBER templates seeded per tenant |
| `backend/src/contexts/org/domain/pipeline.py` | `Pipeline`, `PipelineStatus` |
| `backend/src/contexts/org/domain/plans.py` | FREE, PRO, ENTERPRISE plan constants |
| `backend/src/contexts/org/application/create_organization.py` | Signup use case (atomic org + settings + first user) |
| `backend/src/contexts/org/application/accept_invite.py` | Invite acceptance use case |
| `backend/src/contexts/org/handlers/signup_org.py` | Public `POST /signup` Lambda |
| `backend/src/contexts/org/handlers/get_org_by_slug.py` | Public `GET /orgs/by-slug/{slug}` (workspace-code resolver, called from the login form) |
| `backend/src/contexts/org/handlers/get_current_org.py` | Authed `GET /orgs/current` |
| `backend/src/contexts/org/handlers/update_settings.py` | Authed `PUT /orgs/current/settings` |
| `backend/src/contexts/org/handlers/send_invite.py` | Authed `POST /orgs/current/invites` |
| `backend/src/contexts/org/handlers/accept_invite.py` | Public `POST /invites/{token}/accept` |
| `backend/src/contexts/org/handlers/list_roles.py` + CRUD | Custom roles management |
| `backend/src/contexts/org/handlers/list_pipelines.py` + CRUD | Custom pipelines management |
| `backend/src/contexts/org/infrastructure/dynamo_repository.py` | ORG# key access layer |
| `backend/src/shared_kernel/tenant_keys.py` | Centralized key builders — the only place PKs are string-formatted |
| `backend/src/shared_kernel/permissions.py` | `require(ctx, permission)` helper |
| `backend/src/contexts/org/handlers/pre_token_trigger.py` | Cognito pre-token-generation Lambda |
| `backend/scripts/backfill_neurostack.py` | One-time migration script |
| `backend/tests/test_multitenancy.py` | Cross-tenant isolation tests |

### Modified files
| File | What changes |
|------|--------------|
| [backend/src/shared_kernel/auth_context.py](backend/src/shared_kernel/auth_context.py) | Add `org_id` field to `AuthContext`; read from JWT `custom:orgId` |
| [backend/cdk/stack.py](backend/cdk/stack.py) | Add `custom:orgId` attribute; cert for `taskflow.neurostack.in`; pre-token trigger; single-origin CORS list; `POST /signup` public route; Route53 records in the `neurostack.in` zone |
| `backend/src/contexts/*/infrastructure/dynamo_repository.py` (×8) | Accept `org_id`, route all PK construction through `tenant_keys` |
| [backend/src/contexts/user/infrastructure/dynamo_repository.py](backend/src/contexts/user/infrastructure/dynamo_repository.py) | `_generate_employee_id` reads `settings.employee_id_prefix` instead of hardcoded `EMP-` |
| [backend/src/contexts/user/domain/entities.py](backend/src/contexts/user/domain/entities.py) | Add `org_id`, `role_id`; `system_role` becomes backward-compat property |
| [backend/src/contexts/user/domain/value_objects.py](backend/src/contexts/user/domain/value_objects.py) | `SystemRole` enum demoted to default role IDs |
| [backend/src/contexts/project/domain/value_objects.py](backend/src/contexts/project/domain/value_objects.py) | `ProjectRole` enum demoted likewise |
| [backend/src/contexts/task/domain/entities.py](backend/src/contexts/task/domain/entities.py) | `domain` → `pipeline_id`; `status` free-form |
| [backend/src/contexts/user/handlers/create_user.py](backend/src/contexts/user/handlers/create_user.py) | `org_id` always from `AuthContext`, never from body; plan-limit check |
| All ~15–25 handlers using `PRIVILEGED_ROLES` | Replace with `require(ctx, "<permission>")` |
| `backend/src/contexts/dayoff/application/*.py` | Validate `leave_type` against `OrgSettings.leave_types` |
| `backend/src/contexts/upload/handlers/presign.py` | Enforce `orgs/{orgId}/` prefix on every key |

### Deleted / demoted
- Any hardcoded `cors_origins` list
- `SystemRole`/`ProjectRole` enums as authoritative role source (kept as default seeds only)
- Hardcoded `EMP-` prefix in employee ID generator

---

## 5. Frontend changes (file-by-file)

### New files
| File | Purpose |
|------|---------|
| `frontend/src/providers/TenantProvider.tsx` | Reads workspace code from `localStorage.workspace` / `?workspace=` query / login form; fetches org config; configures Amplify; exposes `TenantContext` |
| `frontend/src/components/WorkspaceField.tsx` | Reusable workspace-code input with debounced availability check (used on login + signup) |
| `frontend/src/app/login/page.tsx` | Three-field login (workspace code, employee ID, password); pre-fills workspace from query/localStorage |
| `frontend/src/lib/i18n.ts` | Base strings + tenant terminology overrides, `t(key)` function |
| `frontend/src/lib/api/orgs.ts` | API client for org/settings/roles/pipelines/invites |
| `frontend/src/hooks/useTenantPipelines.ts` | Reads pipelines from `TenantContext` |
| `frontend/src/components/FeatureGate.tsx` | Conditional render based on `settings.features[key]` |
| `frontend/src/app/signup/page.tsx` | Public org signup (name, slug, owner email/password) |
| `frontend/src/app/invite/[token]/page.tsx` | Invite acceptance page |
| `frontend/src/app/(dashboard)/settings/organization/page.tsx` | Branding, terminology, locale, features, leave types |
| `frontend/src/app/(dashboard)/settings/roles/page.tsx` | Custom roles editor with permission matrix |
| `frontend/src/app/(dashboard)/settings/pipelines/page.tsx` | Custom task pipelines editor |

### Modified files
| File | What changes |
|------|--------------|
| [frontend/src/types/task.ts](frontend/src/types/task.ts) | Delete `DOMAIN_STATUSES`, `DOMAIN_LABELS`, `TASK_STATUS_LABEL`, `TASK_STATUS_COLORS`, `getStatusProgress` → replace with `useTenantPipelines()` |
| [frontend/tailwind.config.ts](frontend/tailwind.config.ts) | `primary`/`accent` colors become CSS variables: `rgb(var(--color-primary) / <alpha-value>)` |
| `frontend/src/app/globals.css` | Declare `--color-primary`, `--color-accent` CSS vars with defaults |
| `frontend/src/components/task/TaskKanban.tsx` | Columns derived from current pipeline instead of hardcoded domain |
| `frontend/src/app/(dashboard)/**/*.tsx` (~40–60 files) | Replace hardcoded "Task"/"Project"/"Employee" strings with `t("task.singular")` etc. |
| `frontend/src/app/(dashboard)/layout.tsx` | Wrap in `<TenantProvider>`; sidebar entries wrapped in `<FeatureGate>` |
| Every `bg-blue-600` / `text-indigo-500` etc. | Migrate to `bg-primary` / `text-primary` |
| [frontend/src/app/(dashboard)/birthdays/page.tsx](frontend/src/app/%28dashboard%29/birthdays/page.tsx) | Remove Giridharan mock data; wrap in `<FeatureGate feature="birthday_wishes">` |
| `frontend/src/lib/auth/AuthProvider.tsx` | Pulls Cognito client ID from `TenantContext` instead of `.env` hardcode |

---

## 6. Desktop app changes

| File | Change |
|------|--------|
| [desktop/internal/config/config.go](desktop/internal/config/config.go) | Keep only `API_URL` baked in via ldflags (pointing at `https://api.taskflow.neurostack.in`); drop `APP_NAME` bake-in |
| `desktop/internal/config/workspace.go` (**new**) | Read/write `~/.taskflow/workspace.json` with saved workspace code |
| `desktop/frontend/src/FirstRun.tsx` (**new**) | First-launch "Enter your workspace code" panel (accepts `acme`, not a full URL) |
| `desktop/internal/auth/cognito.go` | Resolve org via `GET /orgs/by-slug/{workspace}` before SRP login |
| `desktop/internal/monitor/screenshot.go` | Skip screenshot goroutine if `features.screenshots == false` |
| `desktop/internal/tray/tray.go` | Tooltip uses `settings.display_name`; add "Switch Workspace" menu item |

---

## 7. Infrastructure changes

| Resource | Before | After |
|----------|--------|-------|
| Domain | `taskflow-ns.vercel.app` hardcoded | Route53 records in existing `neurostack.in` zone: `taskflow.neurostack.in` (CloudFront) + `api.taskflow.neurostack.in` (API Gateway) |
| ACM certs | None (Vercel-managed) | `taskflow.neurostack.in` cert in `us-east-1` (CloudFront) and `ap-south-1` (API Gateway). No wildcard cert. |
| API Gateway domain | Default | Custom `api.taskflow.neurostack.in` |
| CORS | Hardcoded list in stack.py | Single-origin literal `['https://taskflow.neurostack.in', 'http://localhost:3000']` validated in Lambda against request `Origin` |
| Cognito custom attributes | `employeeId` only | + `orgId` (immutable), `roleId`, `systemRole` |
| Cognito triggers | None | Pre-token-generation Lambda |
| DynamoDB table | Single table, no `org_id` | Same table, keys prefixed with `ORG#{id}#` |
| S3 bucket | `taskflow-uploads-prod` | Same bucket, object keys prefixed `orgs/{orgId}/` |
| Public routes | Only `POST /users/login` | + `POST /signup`, `GET /orgs/by-slug/{slug}`, `POST /invites/{token}/accept` |
| Scheduled Lambdas | None | Nightly retention sweeper (deletes activity beyond `plan.retention_days`) |
| Rate limiting | None | WAF rate-based rule keyed on `x-workspace-code` header set by the frontend after the workspace resolves |

---

## 8. Configuration & defaults

Every customizable setting ships with a sensible default so a new tenant works out of the box without touching the settings page:

| Setting | Default |
|---------|---------|
| `primary_color` | `#4F46E5` (indigo) |
| `accent_color` | `#10B981` (emerald) |
| `timezone` | `Asia/Kolkata` |
| `locale` | `en-IN` |
| `currency` | `INR` |
| `week_start_day` | `1` (Monday) |
| `working_hours_start` / `end` | `09:00` / `18:00` |
| `employee_id_prefix` | `EMP-` |
| `terminology` | `{}` (falls back to base i18n keys) |
| `features.birthday_wishes` | `true` |
| `features.activity_monitoring` | `true` |
| `features.screenshots` | `false` (privacy-safe default) |
| `features.ai_summaries` | `true` |
| `leave_types` | `[casual×12, sick×10, earned×15]` |
| Seeded roles | OWNER, ADMIN, MEMBER (same as current enum) |
| Seeded pipelines | DEVELOPMENT, DESIGNING, MANAGEMENT, RESEARCH (same statuses as today) |
| Plan (new org) | FREE (10 users, 3 projects, 30-day retention) |

---

## 9. Things that do **not** change

To keep scope sane, these stay the same:

- **DDD bounded-context layout** — still 8 contexts + new `org` context
- **Lambda-per-handler deployment model**
- **React Query hooks pattern** in frontend
- **Wails + Preact** stack for desktop
- **CDK Python** for infra
- **Groq AI summary integration** — works per-org, just scoped by `org_id`
- **Single DynamoDB table design**
- **Single Cognito user pool**
- **Existing test suite** — augmented with `with_org("neurostack")` fixture so tests run unchanged

---

## 10. Migration impact on existing NEUROSTACK data

- All existing data becomes `org_id = "neurostack"` via `backend/scripts/backfill_neurostack.py`
- All existing Cognito users get `custom:orgId = "neurostack"` via `admin_update_user_attributes`
- NEUROSTACK is seeded as a Free-tier org first, then manually upgraded to Enterprise
- NEUROSTACK's existing task `domain` strings (`DEVELOPMENT`, etc.) become pipeline IDs of the same name — no task row migration needed
- Users continue accessing the app at `taskflow.neurostack.in` and enter workspace code `neurostack` on the login form — zero login disruption beyond the new field (pre-filled once they've logged in the first time)
- Branding (logo, colors, name) seeded from current hardcoded values so the UI looks identical post-migration
