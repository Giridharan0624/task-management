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
- Plan quotas enforced at create sites + nightly `seat_reconciliation` (03:30 UTC)
- Retention sweeper (03:00 UTC) deleting ACTIVITY past `plan.retention_days`
- Nested-stack refactor — parent ~475/500, Org + Workflow nested stacks absorbing handlers
- DynamoDB PITR (`PointInTimeRecoverySpecification`, 7d staging / 35d prod)
- CloudWatch alarms (5): Api5xx, Api4xx, p95 latency, DDB user errors, DDB throttles
- Log retention on nested-stack Lambdas (3mo staging / 1y prod)
- WAFv2 regional ACL: per-workspace, per-IP, per-IP-signup rate rules
- Multitenancy isolation tests (moto-backed, 7 tests) + rewritten domain tests
- Backfill script `backfill_phase4_phase5.py` run on staging (idempotent)
- **Org suspension**: `POST /platform/orgs/{orgId}/status` (env-allowlist gated via `PLATFORM_ADMIN_USER_IDS`), typed `ORG_SUSPENDED` error code, frontend `SuspendedScreen` full-page block, mid-session event-bus refresh on 403
- **Ownership transfer UI** at `/settings/transfer-ownership` (target picker + email typo guard + token refresh post-transfer)
- **Health check**: `GET /health` (unauthed, DDB reachability probe) — smoke-tested on staging
- **CAPTCHA on signup**: hCaptcha widget (no-op when `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` unset); backend verifier at `shared_kernel/captcha.py`
- **Sentry scaffold**: backend `shared_kernel/observability.py` (init on cold start), frontend `lib/observability/sentry.ts` (dynamic import). Activates when DSN + package present; dormant otherwise.
- **GitHub Actions CI**: `backend-ci.yml` (pytest) + `frontend-ci.yml` (lint + build), path-filtered so changes don't trigger unrelated runs.
- **Email verification flow**: signup creates Cognito user with `email_verified=false`; `/verify-email` page triggers `GetUserAttributeVerificationCode` / `VerifyUserAttribute` via SDK; post-verify token refresh; dashboard + login routes gate on `email_verified === false`. Invite-accept keeps `email_verified=true` (link receipt proves ownership). Defense-in-depth: `AuthContext.email_verified` + `require_email_verified()` helper + typed `EMAIL_NOT_VERIFIED` error code (not applied anywhere yet).

### Not done (still P0-adjacent)

- **Prod data migration** — run backfill against company AWS account when ready to cut over
- **Org deletion with 30-day soft-delete + data export** — needs its own design pass

### Explicitly skipped (previously listed, now de-scoped)

- API Gateway custom domain (`api.taskflow.neurostack.in`) — Option B routing makes this purely cosmetic; users never see the API URL. Revisit only when opening the API to third-party integrations or publishing public docs.

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

P0 substrate is **functionally complete on staging**. Pooled isolation, tenant auth, roles, pipelines, plan enforcement, observability, PITR, WAF, audit spine, suspension, ownership transfer, health check, captcha, Sentry scaffold, CI, and email verification are all live and tested.

What's left before prod cutover is narrow:

1. **Prod backfill rehearsal** — dry-run the migration script against a company-account snapshot.
2. **Org deletion flow** — design pass (30-day soft-delete, export zip, hard-delete sweeper, Cognito user cleanup).

Rough read: ~95% of P0, ~40% of P1, ~15% of P2. P0 is no longer the gating layer — P1 items (desktop code-signing, SES, 2FA) and tenant-lifecycle completeness (deletion) are the realistic next frontier.

**Operator flags to set when activating optional systems:**

- Suspension: `platform_admin_user_ids` in stack config (Cognito sub IDs, comma-separated)
- hCaptcha: `hcaptcha_secret` in stack config + `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` in Vercel
- Sentry: `SENTRY_DSN` (Lambda env) + `NEXT_PUBLIC_SENTRY_DSN` (Vercel) + install `sentry-sdk[aws_lambda]` / `@sentry/browser`
