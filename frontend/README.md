# TaskFlow — Frontend

Next.js 16 (App Router) web app for TaskFlow: a multi-tenant SaaS for task
management, time tracking, attendance, and activity reporting. Deployed to
Vercel; talks to the AWS backend (API Gateway + Lambda + DynamoDB + Cognito).

> This is a **standalone repo** (`taskflow-frontend`) that also lives nested
> inside the `task-management` monorepo. Commits made in the monorepo root do
> **not** capture changes here — push from this repo.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript 5 |
| Server state | TanStack React Query 5 |
| Auth | `amazon-cognito-identity-js` (SRP — the password never leaves the browser) |
| Styling | Tailwind CSS 3 |
| Hosting | Vercel |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run lint` | **`tsc --noEmit`** — typecheck. (Next 16 removed `next lint`.) |

### Environment

Create `.env.local` with all five vars — every value comes from the
**`taskflow-v2`** CloudFormation stack outputs:

```bash
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_INTEGRATIONS_API_URL=https://<integrations-api-id>.execute-api.ap-south-1.amazonaws.com/prod
```

Where they come from:

| Var | Source |
|---|---|
| `NEXT_PUBLIC_API_URL` | `taskflow-v2` output `ApiUrl` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | output `UserPoolId` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | output `UserPoolClientId` |
| `NEXT_PUBLIC_INTEGRATIONS_API_URL` | `IntegrationsNestedStack` — a **separate** API Gateway from the main one |

```bash
aws cloudformation describe-stacks --stack-name taskflow-v2 \
  --profile company --region ap-south-1 \
  --query "Stacks[0].Outputs" --output table
```

> **`NEXT_PUBLIC_*` values are inlined at build time.** Changing one in Vercel
> requires a **redeploy** — editing the variable alone will not affect the
> running site. Keep Vercel's Production/Preview scopes in sync, or previews
> and production will silently talk to different backends.

## Layout

```
src/
  app/
    (auth)/          login · signup · invite · verify-email
    (dashboard)/     dashboard · projects · my-tasks · task-updates · attendance
                     day-offs · reports · admin · platform · settings · profile
    api/download/    [platform] + version — desktop download resolution
    download/        public download page
    page.tsx         marketing landing
    privacy · terms · security · status
  components/        feature-scoped UI (task, project, reports, settings,
                     tenant, admin, landing, …) + `ui/` primitives
  lib/
    api/             15 per-resource clients, thin wrappers over `fetch`
    hooks/           29 React Query hooks + UX helpers (useAutosaveDraft,
                     useUndoableDelete, useUnsavedChangesGuard, useUrlState…)
    auth/            Cognito SRP client + AuthProvider
    tenant/          workspace-code resolver, tenant context, branding
    permissions/     client-side RBAC helpers
    theme/ · utils/ · observability/
  types/
```

**Architecture:** `lib/api/*` (fetch) → `lib/hooks/*` (React Query) → components.
The hook layer is foundational — changes there ripple across many pages.

## Multi-tenancy

Every non-global record is scoped to an `org_id`, and the ID token carries
`custom:orgId` / `custom:systemRole` (injected by a Cognito pre-token-generation
Lambda).

Login asks for **workspace code + email + password**. The workspace code themes
the login screen and validates that the token's `custom:orgId` matches — it is
**not** part of the credential.

`lib/tenant/` resolves the workspace code and applies per-org branding
overrides. Plan tier (`FREE` / `PRO` / `ENTERPRISE`) gates features via
`FeatureGate`; the server is always the authority — client gating is UX only.

## Desktop app downloads

The download page and `/api/download/*` resolve binaries from **GitHub Releases**
only — there is no S3/CloudFront mirror.

- `GET /api/download/[platform]` (`windows` · `macos` · `linux`, plus
  `?format=deb|appimage`) → looks up the latest release, matches the platform
  asset, and 302-redirects to it.
- `GET /api/download/version` → `{ version }` from the latest release tag.

Both cache GitHub's response for 10 minutes at the edge to stay under the
unauthenticated 60-req/hour API rate limit. Change the target by editing `REPO`
in those routes.

## Deployment

Vercel builds from this repo. Verify after deploying:

1. Build succeeded (`npm run lint` = `tsc --noEmit` runs in CI).
2. **Production** env vars match the `taskflow-v2` outputs above.
3. Login works end to end, and the download page resolves a real installer.
