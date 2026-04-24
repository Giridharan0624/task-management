# SaaS Migration — Status Against P0/P1/P2 Roadmap

State of the `Develop` branch as of 2026-04-22 (after Session 7). Everything below is live on **staging**; prod cutover has not happened.

---

## P0 — Must ship before any prod tenant

### Done

- Multi-tenant key scoping (`ORG#{org}#` everywhere, `tenant_keys.py` centralized)
- `org_id` propagation via `AuthContext` + ContextVar
- Cognito pre-token trigger injecting `custom:orgId` / `custom:systemRole` / `custom:roleId`
- Signup (two-phase with Cognito rollback) + workspace-code login (Option B: email-only, workspace resolved from JWT)
- Invite flow (send / list / revoke / accept) consolidated into Admin → Users
- `OrgSettings` — branding, terminology, locale, features, leave types, employee-ID prefix
- Phase 4: 35-permission catalog, `require()` / `role_has()` / `has_permission()` helpers, default roles seeded, `invalidate_role_cache()` wired into role edits
- Phase 5: Pipeline entity + `PipelineStatus`, dual-read alias on `Task.domain` ↔ `Task.pipeline_id`, frontend `usePipelines` consumed by 7 surfaces
- Audit log (`shared_kernel/audit.py`, `PK=ORG#{org}#AUDIT`) + `list_audit_events` handler with friendly action labels
- Plan quotas enforced at create sites + nightly `seat_reconciliation` (03:30 UTC)
- Retention sweeper (03:00 UTC) deleting ACTIVITY past `plan.retention_days`
- Hard-delete sweeper (04:00 UTC) for orgs past 30-day grace period (Session 2)
- Nested-stack refactor — parent + `OrgNestedStack` + `WorkflowNestedStack`
- DynamoDB PITR (7d staging / 35d prod)
- CloudWatch alarms (5): Api5xx, Api4xx, p95 latency, DDB user errors, DDB throttles
- Log retention on nested-stack Lambdas (3mo staging / 1y prod)
- WAFv2 regional ACL: per-workspace, per-IP, per-IP-signup rate rules
- Multitenancy isolation tests (moto-backed, 7 tests) + rewritten domain tests
- Backfill script `backfill_phase4_phase5.py` run on staging (idempotent)
- **Org suspension** (Session 1): `POST /platform/orgs/{orgId}/status` env-allowlist gated, typed `ORG_SUSPENDED` error code, frontend `SuspendedScreen`, mid-session refresh on 403
- **Ownership transfer UI** (Session 1): `/settings/transfer-ownership` with target picker + email typo guard
- **Health check** (Session 1): `GET /health` unauthed DDB reachability probe
- **CAPTCHA on signup** (Session 1): hCaptcha widget + backend verifier (dormant until `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` set)
- **Sentry scaffold** (Session 1): dormant until DSN + package present
- **GitHub Actions CI** (Session 1): backend pytest + frontend lint/build
- **Email verification flow** (Session 2): signup creates `email_verified=false`; `/verify-email` page; `require_email_verified()` gate applied to 7 sensitive handlers
- **Org deletion lifecycle** (Session 2): 30-day soft-delete, JSON export to S3, nightly sweeper, `/settings/delete-workspace` UI with export/recover/delete
- **Change-email self-service** (Session 2): `/profile/change-email` with Cognito code challenge + DB sync
- **2FA TOTP** (Session 3): `/profile/mfa` enroll/disable, login MFA challenge, OWNER-side reset from Users page
- **ProjectRole refactor** (Session 4): per-org project role records with `scope="project"`, 4 defaults seeded at signup, MemberList dropdowns populated from API
- **In-app notifications** (Session 5): per-user partition, polling NotificationCenter, mark-read + mark-all-read, emitted on `task.assigned`
- **Webhooks out** (Session 5): per-org subscriptions, HMAC-SHA256 Stripe-shape signing, `/settings/webhooks` CRUD UI with secret-reveal-once
- **Platform operator console** (Session 5 + 7): `PATCH /platform/orgs/{orgId}/features`, `/platform` frontend page with slug lookup + suspend/unsuspend + feature toggles
- **Audit log UI friendly action labels** (Session 7)
- **i18n foundation** (Session 6): `useLocale` + `useFormat` hooks binding Intl helpers to tenant settings; two call sites migrated (MemberList, TaskCard)
- Staging deploys verified — most recent deploy 2026-04-22 exit 0

### Not done (still P0-adjacent)

- **Prod data migration** — run backfill against company AWS account when ready to cut over
- **Organization deletion has no operator backstop** — owner-initiated works; if an owner loses access before completing the flow, there's no support path yet

### Explicitly skipped (previously listed, now de-scoped)

- API Gateway custom domain (`api.taskflow.neurostack.in`) — Option B routing makes this purely cosmetic; users never see the API URL. Revisit only when opening the API to third-party integrations or publishing public docs.

---

## P1 — Needed within first few tenants

### Done

- Per-org pipelines (create / edit / reorder / colors)
- Roles UI (matrix editor, clone, delete) — supports both system- and project-scope roles
- Glossary (terminology) page simplified
- Birthdays gated behind `features.birthday_wishes` + moved under Dev section
- Frontend branding via CSS variables
- Weekly AI-rollup digest for admins (`/reports/weekly`)
- `ProjectRole` → per-org role records with `scope="project"` (Session 4)
- Bulk CSV user import (Session 1)
- Change-email flow with re-verification (Session 2)
- 2FA via Cognito TOTP (Session 3)

### Not done

- **SES migration from Gmail SMTP** — Gmail caps ~500/day; fine at current tenant count, real problem at ~5+ tenants
- **Desktop first-run UI** (Preact login, no workspace field under Option B) — separate repo
- **Desktop macOS build + Wails dev path + `.dmg`** — needs a Mac build host or macOS GitHub Actions runner
- **Code-signing**: Windows Authenticode, macOS notarization, Linux repo key — cert purchases needed
- **Auto-update E2E test** (Squirrel flow verified manually only) — separate repo
- **CloudFront in front of Vercel web app** — recommend skip, Vercel has its own CDN

---

## P2 — Post-launch polish

### Done

- UX polish pass on Roles, Terminology/Glossary, Team pages
- Plan-limit banner (OWNER, self-hides)
- Setup checklist on dashboard
- Stagger-up / fade-in animations
- Tenant logo with `hideSubline`
- **Audit log viewer UI** with filters, search, pagination, expandable details, friendly action labels
- **Per-org experimental feature flag toggle** (Session 5 + 7) — platform operator UI at `/platform`
- **In-app notifications service** (Session 5)
- **Outbound webhooks** (Session 5) — infra-ready for third-party integrations

### Not done

- SSO / SAML
- Stripe billing
- Marketing site, onboarding tour, compliance pages (ToS / Privacy / DPA — stubs shipped; legal review outstanding)
- **Full i18n beyond terminology overrides** — hooks + utils shipped; ~35 call sites still use hardcoded `toLocaleDateString('en-US', ...)`. Incremental migration.

---

## Summary

P0 + most of P1 is **functionally complete on staging**. Pooled multi-tenancy, tenant auth with 2FA + email verification, roles (system + project, per-org), pipelines, plan enforcement, observability, PITR, WAF, audit spine, suspension, ownership transfer, 30-day deletion lifecycle, notifications, webhooks, platform console, CI — all live and tested.

What remains before prod cutover:

1. **Prod backfill rehearsal** — dry-run `backfill_neurostack.py` against a company-account snapshot.
2. **Cutover decision** — timing, Vercel env swap, Cognito pool identity flip.

Rough read: **~95% of P0, ~70% of P1, ~35% of P2**.

**Operator flags to set when activating optional systems:**

| Flag | Where | Effect |
|---|---|---|
| `platform_admin_user_ids` | CDK stage config + `NEXT_PUBLIC_PLATFORM_ADMIN_USER_IDS` in Vercel | Comma-separated Cognito subs that can call `/platform/*` endpoints + see the `/platform` frontend |
| `hcaptcha_secret` | CDK stage config + `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` in Vercel | Enables signup captcha |
| `SENTRY_DSN` | Lambda env + `NEXT_PUBLIC_SENTRY_DSN` | Activates Sentry (also requires `sentry-sdk[aws_lambda]` in deps layer + `@sentry/browser` installed) |
| `HARD_DELETE_GRACE_DAYS` | Lambda env | Compresses the 30-day grace (staging rehearsal only) |

---

## Session history

| Session | Theme | Key deliverables |
|---|---|---|
| 1 | Admin surfaces | Audit log viewer, bulk CSV import, command-palette people search |
| 2 | Lifecycle | Org deletion (30-day soft-delete + export + sweeper), change-email, `require_email_verified` gate |
| 3 | Auth hardening | TOTP 2FA enroll/challenge/reset |
| 4 | Roles refactor | ProjectRole → per-org records with scope='project' |
| 5 | Tenant comms | In-app notifications, outbound webhooks, platform feature-flag toggle |
| 6 | Polish | i18n hooks + foundation |
| 7 | Frontend closure | Webhooks UI, platform console, MemberList dropdown, audit labels, first i18n migrations |
