# TaskFlow — Documentation Index

All project documentation lives here, organised by purpose. Top-level files (`PRD.md`, `TDD.md`, `CLAUDE.md`, `README.md`) stay at the repo root.

## Categories

### `architecture/` — System internals

- [PLAN-LIMITS.md](architecture/PLAN-LIMITS.md) — Plan tiers, capacity caps, feature gating
- [RBAC-DOCUMENTATION.md](architecture/RBAC-DOCUMENTATION.md) — System roles, project roles, permission matrix
- [TIMER-ARCHITECTURE.md](architecture/TIMER-ARCHITECTURE.md) — Timer state machine across web + desktop

### `saas/` — Multi-tenant migration

- [SAAS-MIGRATION.md](saas/SAAS-MIGRATION.md) — Original phased migration plan
- [SAAS-CHANGES.md](saas/SAAS-CHANGES.md) — Side-by-side change log per phase
- [SAAS-PROGRESS.md](saas/SAAS-PROGRESS.md) — Running narrative of what shipped
- [SAAS-STATUS.md](saas/SAAS-STATUS.md) — Current state vs. P0/P1/P2 roadmap
- [SAAS-ROADMAP.md](saas/SAAS-ROADMAP.md) — Forward-looking roadmap
- [PHASE-1-STAGING-DEPLOY.md](saas/PHASE-1-STAGING-DEPLOY.md) — Staging deploy notes for phase 1

### `guides/` — How-to / runbooks

- [TEAMMATE-ONBOARDING.md](guides/TEAMMATE-ONBOARDING.md) — New-engineer onboarding
- [DEMO-SCRIPT.md](guides/DEMO-SCRIPT.md) — Demo recording script
- [ACCOUNT-MIGRATION-GUIDE.md](guides/ACCOUNT-MIGRATION-GUIDE.md) — Cross-AWS-account migration
- [CLIENT-GUIDE.md](guides/CLIENT-GUIDE.md) — End-customer usage guide
- [FEATURE-DEVELOPMENT-GUIDE.md](guides/FEATURE-DEVELOPMENT-GUIDE.md) — How to add a feature end-to-end
- [FRESH-ACCOUNT-DEPLOYMENT-GUIDE.md](guides/FRESH-ACCOUNT-DEPLOYMENT-GUIDE.md) — First-time deploy to a new AWS account

### `desktop/` — Desktop companion app

- [CI-CD-SETUP.md](desktop/CI-CD-SETUP.md) — Build / signing / release pipeline
- [CROSS-PLATFORM-PLAN.md](desktop/CROSS-PLATFORM-PLAN.md) — Windows / macOS / Linux build targets
- [RELEASE-GUIDE.md](desktop/RELEASE-GUIDE.md) — Cutting a desktop release
- [RELEASE-SIGNING.md](desktop/RELEASE-SIGNING.md) — Code-signing certificates and process
- [DESKTOP-CONSENT-AND-INSTALLER-PLAN.md](desktop/DESKTOP-CONSENT-AND-INSTALLER-PLAN.md) — First-run consent + installer UX

### `planning/` — Future features and proposals

- [UX-BACKLOG.md](planning/UX-BACKLOG.md) — UX backlog with acceptance criteria
- [CHAT-FEATURE-PLAN.md](planning/CHAT-FEATURE-PLAN.md) — In-app chat proposal
- [CI-PIPELINE-PLAN.md](planning/CI-PIPELINE-PLAN.md) — CI/CD pipeline proposal
- [WELCOME-EMAIL-OTP-PLAN.md](planning/WELCOME-EMAIL-OTP-PLAN.md) — Welcome email + OTP flow

### `api/` — API reference

- [API.md](api/API.md) — REST endpoint reference

### `reference/` — Catalog & legacy

- [FEATURES.md](reference/FEATURES.md) — Feature catalog
- [task-management-prd.md](reference/task-management-prd.md) — Legacy PRD (predates `PRD.md` at repo root)

### `bug-reports/` — Historical investigations

- [Bug-Report-Go.md](bug-reports/Bug-Report-Go.md) — Desktop P0 security report
- [Bug-Report-Go-v2.md](bug-reports/Bug-Report-Go-v2.md) — Follow-up
- [Bug-Report-Go-v3.md](bug-reports/Bug-Report-Go-v3.md) — Third pass

## Adding a new doc

1. Pick the category that fits — if none does, propose a new folder rather than dropping it loose at `docs/`.
2. Match the existing file-naming convention in the folder (UPPER-DASH-CASE).
3. Add a one-line entry to this index under the right category.
4. Cross-reference from `CLAUDE.md`, `TDD.md`, or `README.md` if the doc is load-bearing for daily work.
