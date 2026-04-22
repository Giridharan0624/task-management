# SaaS Migration — Status Against P0/P1/P2 Roadmap

Verified state of the `saas-migration` branch as of 2026-04-22. Reflects what is live on **staging** only — no prod cutover has happened.

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
- Audit log (`shared_kernel/audit.py`, `PK=ORG#{org}#AUDIT`) + `list_audit_events` handler
- Suspension gate helper (`require_not_suspended`)
- Plan quotas enforced at create sites + nightly `seat_reconciliation` (03:30 UTC)
- Retention sweeper (03:00 UTC) deleting ACTIVITY past `plan.retention_days`
- Nested-stack refactor — parent 463/500, Org + Workflow nested stacks absorbing handlers
- DynamoDB PITR (`PointInTimeRecoverySpecification`, 7d staging / 35d prod)
- CloudWatch alarms (5): Api5xx, Api4xx, p95 latency, DDB user errors, DDB throttles
- Log retention on nested-stack Lambdas (3mo staging / 1y prod)
- WAFv2 regional ACL: per-workspace, per-IP, per-IP-signup rate rules
- Multitenancy isolation tests (moto-backed, 7 tests) + rewritten domain tests
- Backfill script `backfill_phase4_phase5.py` run on staging (idempotent)
- Staging deploys verified (nested-stack 288s, observability 168s, both exit 0)

### Not done (still P0-adjacent)

- API Gateway custom domain + cert — to live at `api.taskflow.neurostack.in`; CDK wiring deferred until cutover.
- Prod data migration (run when ready — cutover to company account)
- Org deletion with 30-day soft-delete + data export (own design pass)
- Email verification full flow — audit done (all signup/invite paths set `email_verified=true` unconditionally in [cognito_service.py:34](backend/src/contexts/user/infrastructure/cognito_service.py#L34) and [cognito_service.py:77](backend/src/contexts/user/infrastructure/cognito_service.py#L77)). Recommended path: signup creates user with `email_verified=false`, frontend post-signup verify page calls `GetUserAttributeVerificationCode` → `VerifyUserAttribute` via Cognito SDK. ~2-3 hours work; deferred.

### Done this session

- Org suspension: `POST /platform/orgs/{orgId}/status` (env-allowlist gated via `PLATFORM_ADMIN_USER_IDS`), typed `ORG_SUSPENDED` error code, frontend `SuspendedScreen` full-page block, mid-session event-bus refresh on 403
- Ownership transfer UI at `/settings/transfer-ownership` (target picker + email typo guard + token refresh post-transfer)
- Health check: `GET /health` (unauthed, DDB reachability probe)
- CAPTCHA on signup: hCaptcha widget (no-op when `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` unset); backend verifier at `shared_kernel/captcha.py`
- Sentry scaffold: backend `shared_kernel/observability.py` (init on cold start), frontend `lib/observability/sentry.ts` (dynamic import). Activates when DSN + package present; dormant otherwise.
- GitHub Actions CI: `backend-ci.yml` (pytest) + `frontend-ci.yml` (lint + build), path-filtered so changes don't trigger unrelated runs.

---

## P1 — Needed within first few tenants

### Done

- Per-org pipelines (create / edit / reorder / colors)
- Roles UI (matrix editor, clone, delete)
- Glossary (terminology) page simplified
- Birthdays gated behind `features.birthday_wishes` + moved under Dev section
- Frontend branding via CSS variables

### Not done

- `ProjectRole` enum → per-org role records with `scope="project"`
- Bulk CSV user import
- Change-email flow with re-verification
- SES migration from Gmail SMTP
- 2FA via Cognito TOTP
- Desktop first-run UI (Preact login, no workspace field under Option B)
- Desktop macOS build + Wails dev path + `.dmg`
- Code-signing: Windows Authenticode, macOS notarization, Linux repo key
- Auto-update E2E test (Squirrel flow verified manually only)
- CloudFront in front of Vercel web app (recommend skip)

---

## P2 — Post-launch polish

### Done

- UX polish pass on Roles, Terminology/Glossary, Team pages
- Plan-limit banner (OWNER, self-hides)
- Setup checklist on dashboard
- Stagger-up / fade-in animations
- Tenant logo with `hideSubline`

### Not done

- SSO / SAML
- Stripe billing
- Marketing site, onboarding tour, compliance pages (ToS / Privacy / DPA)
- Full i18n beyond terminology overrides
- Audit log UI (handler ships data; no viewer page)
- Per-org feature flag for experimental toggles
- In-app notifications service

---

## Summary

P0 SaaS substrate is **functionally complete on staging** — pooled isolation, tenant auth, roles, pipelines, plan enforcement, observability, PITR, WAF, and the audit spine are all live and tested. What is blocking a real prod cutover is operational and lifecycle plumbing rather than tenancy itself: no way to suspend or delete orgs from the UI, no custom domain, no CI/CD, no error tracking, and prod migration has not run.

Rough honest read: ~80% of P0, ~40% of P1, ~15% of P2.

About **1 week of focused work** gets to minimum-viable-ship:

1. Suspension endpoint + UI
2. Ownership-transfer UI
3. Sentry (frontend + backend)
4. Health check endpoint
5. API Gateway custom domain
6. Prod backfill rehearsal

Everything else — SSO, billing, desktop signing, SES — is real but not launch-blocking for a small first cohort.
