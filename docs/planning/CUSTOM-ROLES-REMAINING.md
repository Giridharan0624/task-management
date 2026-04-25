# Custom Roles — Remaining Work

Residual gaps after the Session 8 custom-role unification. The end-to-end path for tenant-defined system roles works today — OWNERs can create custom roles in `/settings/roles`, assign them through the admin/users dropdown / invite flow / admin-create flow, and the UI (sidebar, page gates) reflects permissions live. This document lists what is still hardcoded, pessimistic, or stale and what it takes to close each gap.

## Status (2026-04-25)

- **Gap 1 — Bulk CSV import:** CLOSED. CSV validator now reads tenant roles from `/orgs/current/roles`; custom role_ids accepted alongside ADMIN/MEMBER.
- **Gap 2 — Token staleness:** Largely a non-issue thanks to the existing 15s `syncProfile` polling in `(dashboard)/layout.tsx`. Backend already re-reads `system_role` from DDB per request. No fix needed unless a permission edit must propagate in <15 s.
- **Gap 3 — ProjectList Create button:** CLOSED. Button now uses live `useHasPermission('project.create')` with a legacy fallback during load.
- **Gap 4 — `canManageAdmins` for custom roles:** CLOSED. Backend `UpdateUserRoleUseCase` now gates on `user.role.manage` instead of literal OWNER; admin/users page dropdown gates on `systemPerms.canManageAdmins`. Custom roles with `user.role.manage` can now reassign users.
- **Gap 5 — Project-scope custom roles:** OPEN. Still uses hardcoded `ProjectRole` enum. Sized 4–6h, separate session.
- **Gap 6 — Role deletion when referenced:** CLOSED. `delete_role.py` now scans for users carrying the role_id and rejects with a list of affected users.
- **Gap 7 — Audit snapshot of role permissions:** CLOSED. `update_user_role.py` now emits `USER_ROLE_CHANGED` events (previously the constant was defined but never written) with a `metadata.role_permissions_at_assignment` snapshot, plus before/after `system_role`. ROLE_CREATED / ROLE_UPDATED already snapshot via `before`/`after` — no change there.

Open gaps below are kept for reference. Closed gaps stay in this file as documentation of what changed and where.

Read in order of priority (most user-facing first).

---

## Gap 1 — Bulk CSV Import still restricted to ADMIN/MEMBER

**Where:** [frontend/src/components/admin/BulkImportUsersModal.tsx](../../frontend/src/components/admin/BulkImportUsersModal.tsx)
**Backend path:** `contexts/user/handlers/bulk_create_users.py` → `CreateUserUseCase._resolve_target_role`

**What works today:** the backend use case (`CreateUserUseCase`) already accepts custom role_ids via `_resolve_target_role`. So the validation layer is ready.

**What's broken:** the CSV upload modal hardcodes the allowed role column values to `ADMIN` / `MEMBER`. A tenant that created a `tester` custom role can't bulk-import 50 testers; they'd have to be imported as MEMBER and then promoted one by one.

**Fix:**
- Modal reads `useRoles({ scope: 'system' })` and uses the returned role names for the CSV schema documentation.
- The per-row validator accepts any case-insensitive match against `{r.roleId for r in assignableRoles}` (owner excluded).
- Backend `BulkCreateUsersUseCase` (if it calls `CreateUserUseCase` per row, which it does — see handler line 77) already enforces validation, so the frontend change is sufficient for the happy path. Confirm on the first batch test that error messages for typos surface cleanly.

**Estimated effort:** ~40 lines in the modal, 1 hour including a CSV round-trip test.

---

## Gap 2 — Token staleness after self-role-change

**Where:** every page that reads `user.systemRole` from `AuthProvider`.

**What's broken:** when an OWNER reassigns a user from ADMIN to `tester` (or vice versa), the backend flips immediately (DDB write + Cognito `custom:systemRole` update + in-memory cache invalidation). For the user being reassigned:
- Their *next login* picks up the new role (the pre-token trigger re-derives `custom:roleId`).
- Their *current session* keeps the old JWT until Cognito reissues (default ID token TTL = 1 hour).
- Meanwhile, `useAuth().user.systemRole` is still the old value, which the frontend uses for optimistic sidebar rendering, the legacy fallback in `useSystemPermission`, and a few direct `=== 'OWNER'` checks.

**What still works despite staleness:** backend permission checks are live-DDB-backed with a 60s TTL, so any API call actually tries to perform an action the user no longer has will return 403. It's a UI cosmetic issue — the user sees nav items that 403 on click rather than being hidden.

**Fix (preferred):**
- Call `fetchAuthSession({ forceRefresh: true })` in `AuthProvider` immediately after a successful role change targeting the current user.
- Add a backend push (EventBridge → frontend via SSE or polling the `/users/me` endpoint) to trigger the same refresh on OTHER users' sessions when their role changes. Cheaper alternative: the existing 15-second `syncProfile` polling in [frontend/src/app/(dashboard)/layout.tsx:514](../../frontend/src/app/%28dashboard%29/layout.tsx#L514) already reads the DB `system_role` and writes it to AuthProvider — so within 15s the `user.systemRole` value updates without a token refresh. That means this gap is mostly closed already for the "someone else changed my role" case.

**What actually needs fixing:** `useAuth` token still holds the stale claim, so if any backend handler ever bypasses DDB lookup and reads `claims["custom:systemRole"]` directly, it'll get the old value. Grep for that pattern; there shouldn't be any (auth_context.py re-reads from DDB on line 50-56), but confirm.

**Estimated effort:** 1–2 hours of auditing, plus 20 lines if the refresh hook is needed.

---

## Gap 3 — ProjectList "Create Project" button during first paint

**Where:** [frontend/src/components/project/ProjectList.tsx](../../frontend/src/components/project/ProjectList.tsx#L51)

**What's broken:** the "Create Project" button's visibility is gated on `systemPerms.canCreateProject`. During the ~300 ms roles fetch, this falls back to `isPrivilegedFallback(systemRole)` which only returns true for literal OWNER/ADMIN. A custom role with `project.create` permission briefly sees no button, then the button appears when roles load.

**Why it's low priority:** it's a single button, not a page gate. The "flash" is momentary and the page itself (browsing projects) renders normally.

**Fix:** mirror the admin-users page pattern — detect custom-role callers and optimistically show the button during load. Or simpler: wait for `systemPerms.isLoading` to be false before rendering the toolbar.

**Estimated effort:** 10 lines.

---

## Gap 4 — `canManageAdmins` fallback is pessimistic for custom roles

**Where:** [frontend/src/lib/hooks/usePermission.ts:145](../../frontend/src/lib/hooks/usePermission.ts#L145)

**What's broken:** during the loading fallback:
```ts
canManageAdmins: systemRole === 'OWNER',
```
A custom role with `user.role.manage` granted would show as `canManageAdmins = false` until roles load, then flip to true. This hides the "Change Role" affordance briefly for custom OWNER-equivalent roles.

**Fix:** same as Gap 3 — add the custom-role detection. Or more fundamentally: stop using role-string fallbacks altogether and instead gate affordances on `isLoading || hasPermission`. That's a bigger refactor but it removes the whole class of "legacy fallback is wrong for custom roles" bugs.

**Estimated effort:** 30 minutes for a surgical fix; 2–3 hours for the broader "drop role-string fallbacks" refactor.

---

## Gap 5 — Project-scope custom roles are not assignable through the UI

**Where:** project member management (project settings page).

**What works today:** the backend `Role` entity has `scope: "system" | "project"`. Tenants can create `scope="project"` roles in /settings/roles. The permission engine resolves them correctly when checking project-scoped permissions like `project.members.manage` or `task.assign.any`.

**What's broken:** the project-member assignment UI uses a hardcoded `ProjectRole` enum (`ADMIN / PROJECT_MANAGER / TEAM_LEAD / MEMBER`) — see [backend/src/contexts/project/domain/value_objects.py](../../backend/src/contexts/project/domain/value_objects.py). There's no way to assign a custom project role to a project member.

**Fix — scope:**
1. Backend: `AddProjectMemberUseCase` validates `project_role` against `org_repo.list_roles(org_id)` filtered by `scope="project"`, same pattern as `UpdateUserRoleUseCase`.
2. Frontend: project member dropdown reads `useRoles({ scope: 'project' })` instead of the hardcoded enum.
3. `ProjectRole` enum becomes the default role_ids (like `SystemRole` did in Session 8).

**Estimated effort:** 4–6 hours. Similar shape to the system-role refactor but touches project member CRUD instead of user role changes.

---

## Gap 6 — Role records can be deleted while users still reference them

**Where:** [backend/src/contexts/org/handlers/delete_role.py](../../backend/src/contexts/org/handlers/delete_role.py)

**What's broken:** deleting a custom role in /settings/roles just removes the role record. Users who had that role_id assigned still carry the string value in `User.system_role`, and the permission resolver falls through to the empty set → they effectively become read-only without any warning. No cascade, no reassignment prompt.

**Fix:**
- Pre-delete check: scan users with `system_role = role_id` (lowercased match). If any exist, either:
  - Block deletion with an error listing the affected users, OR
  - Require a `reassign_to: role_id` parameter that's used to rewrite those users in a transaction.
- Second option is nicer UX but more complex to implement atomically across Cognito + DDB.

**Estimated effort:** 1 hour for the block-on-referenced-users approach; 3–4 hours for the reassignment flow.

---

## Gap 7 — Audit log doesn't record custom-role assignments distinctly

**Where:** `list_audit_events.py` + wherever role assignments are audited.

**What's broken:** audit entries for role changes show `"role_change: ADMIN → MEMBER"`. For custom roles they show `"role_change: tester → member"`. Readable enough, but there's no link from the audit entry to the role definition at the time of the change — if the tenant later edits the `tester` role, the audit record no longer explains what `tester` granted when the assignment happened.

**Fix:** at the time of the role change, snapshot the role's permission set into the audit metadata. Read-only forensic value; low urgency unless someone's asked for it.

**Estimated effort:** 30 minutes.

---

## Out of scope (not remaining work, just flagged)

These were discussed but are separate initiatives, not follow-ups:

- **Custom project pipelines.** Already delivered in Session 5; tenants can create pipelines in /settings/pipelines. Same pattern as roles, fully live.
- **Stripe billing.** Deferred per the top-level SAAS-ROADMAP.
- **Desktop workspace prompt.** Shipped in Session 6 — desktop app reads workspace from `~/.taskflow/workspace.json`.
- **Subdomain routing.** User chose to keep everything on `taskflow.neurostack.in` (single domain, workspace code in login). No wildcard cert needed.

---

## Suggested ordering

If you plan to chip away at these:

1. Gap 2 (token staleness audit) — 1h, confirms there's nothing actually broken.
2. Gap 6 (block deletion of referenced roles) — 1h, prevents a real data-integrity footgun.
3. Gap 1 (bulk import) — 1h, unblocks customer onboarding at scale.
4. Gap 5 (project-scope custom roles) — 4-6h, large feature parity win.
5. Gaps 3, 4, 7 — polish; batch together in a 2-hour pass.

Total to close everything: roughly 10–12 hours of focused work. None of it blocks the core custom-role feature, which is working end-to-end today.
