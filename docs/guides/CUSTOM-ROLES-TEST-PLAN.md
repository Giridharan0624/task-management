# Custom Roles — End-to-End Test Plan

Run on staging. Frontend should be running locally against the staging API. Hard-refresh after starting (Ctrl+Shift+R) to pick up the latest build.

Sister doc: [CUSTOM-ROLES-REMAINING.md](../planning/CUSTOM-ROLES-REMAINING.md) lists the gaps these tests are designed to catch.

## Setup

You need 3 test accounts:
- **OWNER** (already exists — you).
- **ADMIN** account (built-in admin tier).
- **MEMBER** account (built-in member tier).

You'll create custom roles + extra users as scenarios proceed.

---

## Section 1 — Role creation & UI propagation

### Scenario 1: Create a read-only custom role
1. As OWNER → `/settings/roles` → New role.
2. Name: `tester`. Permissions: `user.list`, `project.list.all`, `task.list`, `task.view.all`. Save.
3. **Expect:** role appears in the list with permission count `4`. No email-verification banner.

### Scenario 2: Assign the custom role
1. `/admin/users` → click any MEMBER's role badge.
2. **Expect:** dropdown shows Admin, Member, **Tester** (custom palette color).
3. Select Tester. Toast: "Role updated to tester".
4. **Expect:** badge swaps color and label.

### Scenario 3: Custom role's UI on login
1. Log out, log in as the tester user.
2. **Expect sidebar:** Dashboard, My tasks, Users, Projects, Attendance, Day Offs. **No** Daily Updates, Reports, Settings.
3. Click **Users**.
   - **Expect:** user table renders. **No** Add User, **no** Invite, **no** Bulk Import button. Role dropdowns are read-only badges. No delete in row actions menu.
4. Click any user → bio modal → role badge shows the human-readable role name (e.g. "Tester" not "tester").

---

## Section 2 — Live permission propagation

### Scenario 4: Edit permission, watch it disappear
1. As OWNER (second tab) → `/settings/roles` → Tester → uncheck `user.list`. Save.
2. Tester user (other tab) → wait up to ~60s → refresh.
3. **Expect:** Users link vanishes from sidebar. Direct nav to `/admin/users` redirects to `/dashboard`.
4. Re-check `user.list`, save → tester refreshes → Users link returns.

### Scenario 5: Add permission live
1. As OWNER add `taskupdate.list.all` to Tester. Save.
2. Tester refreshes.
3. **Expect:** Daily Updates appears in sidebar. Page renders.

---

## Section 3 — Invite flow

### Scenario 6: Invite into a custom role (OWNER)
1. OWNER → `/admin/users` → Invite.
2. **Expect:** Role dropdown lists Admin, Member, **Tester**.
3. Invite a fresh email as Tester.
4. Open invite email → set password → land in app.
5. **Expect:** sidebar matches Scenario 3.

### Scenario 7: Invite into a custom role (ADMIN)
1. As OWNER, ensure ADMIN has `user.invite` permission (it does by default).
2. Log in as ADMIN.
3. **Expect:** Invite button visible (the bug we just fixed — used to be OWNER-only).
4. Invite a Member. Confirm it works.

---

## Section 4 — User creation paths

### Scenario 8: Add User modal (OWNER)
1. OWNER → `/admin/users` → Add user.
2. **Expect:** Role dropdown lists Admin, Member, Tester.
3. Create a new user with role Tester. Submit.
4. Verify the new user appears in the table with badge "Tester".

### Scenario 9: Add User modal (ADMIN)
1. Log in as built-in ADMIN.
2. `/admin/users` → Add user.
3. **Expect:** Role dropdown lists **only Member** (no Admin, no Tester) — admins can't create privileged users via custom-role sidestep.

### Scenario 10: Bulk CSV with custom role
1. OWNER → `/admin/users` → Import CSV.
2. **Expect:** "Expected columns" box mentions all assignable roles including `tester`.
3. Upload:
   ```csv
   email,name,role,department,date_of_joining
   bulk1@test.com,Bulk One,tester,Engineering,2026-01-15
   bulk2@test.com,Bulk Two,ADMIN,Operations,
   bulk3@test.com,Bulk Three,fakerole,Engineering,
   ```
4. **Expect preview:** rows 1+2 green-checked; row 3 red with hover error *"Role 'fakerole' is not defined for this workspace"*. Submit blocked.
5. Fix row 3 → MEMBER. Submit. Both successful rows created.
6. Verify in table: bulk1 has `tester`, bulk2 has `ADMIN`, bulk3 has `MEMBER`.

---

## Section 5 — Custom privileged role (the killer feature)

### Scenario 11: Custom role that can manage other roles
1. OWNER → create role `roleManager` with: `user.list`, `user.role.manage`. Save.
2. Assign `roleManager` to a user (call them "Alice").
3. Log in as Alice.
4. **Expect:** Sidebar has Users.
5. `/admin/users` → click any non-OWNER user's role badge.
   - **Expect:** dropdown is **interactive** (this is the Gap 4 fix — used to be OWNER-only).
6. Change a Member to Admin. Verify it sticks. (Open browser devtools to confirm 200 response on `PATCH /users/role`.)

### Scenario 12: Custom role that can delete users
1. OWNER → create role `userJanitor` with: `user.list`, `user.delete`. Save.
2. Assign to a user "Bob".
3. Log in as Bob.
4. `/admin/users` → row actions on a Member.
   - **Expect:** Delete option appears.
5. Delete a Member. Verify row vanishes.
6. Try to delete an ADMIN row.
   - **Expect:** Delete option **does not appear** (Bob doesn't have `user.role.manage`, so can only delete non-privileged users — both frontend `canDelete` and backend `DeleteUserUseCase` enforce this).

### Scenario 13: Custom role that can create projects
1. OWNER → create role `projectMaker` with: `project.create`, `project.list.all`. Save.
2. Assign to a user.
3. `/projects` as that user.
   - **Expect:** "Create Project" button visible **immediately** on first paint (Gap 3 fix — used to flash empty for ~300ms).
4. Create a project. Verify it appears.

---

## Section 6 — Owner / safety guardrails

### Scenario 14: Cannot promote to OWNER
1. OWNER tries `PATCH /users/role` with body `{"user_id": "...", "system_role": "OWNER"}` (use browser DevTools).
2. **Expect:** 403 *"Users cannot be promoted to the Owner role."*

### Scenario 15: Cannot invite as OWNER
1. `POST /orgs/current/invites` with `{"email": "x@y.z", "role_id": "owner"}`.
2. **Expect:** 400 *"The owner role cannot be assigned via invite. Use the ownership-transfer flow instead."*

### Scenario 16: Cannot create as OWNER via Add User
1. `POST /users` with `{"email": "...", "system_role": "OWNER", ...}`.
2. **Expect:** 403 *"An Owner account cannot be created."*

### Scenario 17: Block delete of a referenced role (Gap 6)
1. Ensure `tester` is assigned to at least 1 user.
2. OWNER → `/settings/roles` → delete `tester`.
3. **Expect:** error *"Role 'tester' is still assigned to N user(s) (Name1, Name2, Name3 and X more). Reassign them to a different role before deleting."*
4. Reassign all tester users to MEMBER.
5. Try delete again → **Expect:** succeeds.

### Scenario 18: Cannot create reserved-id role
1. OWNER → `/settings/roles` → New role → name `Owner`. Save.
2. **Expect:** error indicating the role name conflicts with a reserved system role (slug `owner` hits `RESERVED_IDS`).

---

## Section 7 — Management/Members tab classification

### Scenario 19: Custom role with role.manage shows in Management tab
1. OWNER → create role `superAdmin` with `role.manage` + `user.list`. Assign to a user.
2. `/admin/users` → toggle to **Management** tab.
3. **Expect:** the superAdmin user appears alongside built-in admins.
4. Toggle to **Members** → user does not appear.

### Scenario 20: Custom role without role.manage stays in Members tab
1. The Tester user from Scenario 1 (no role.manage) → should appear in **Members** tab.

---

## Section 8 — Loading-state polish

### Scenario 21: No "no permission" flash for custom roles
1. Log in as a custom-role user with admin-tier permissions.
2. `/admin/users` cold load.
3. **Expect:** brief spinner, then the page (not "no permission" → page).

### Scenario 22: Built-in OWNER/ADMIN renders immediately
1. Log in as OWNER.
2. Navigate to `/admin/users`.
3. **Expect:** page renders immediately, no spinner detour. (Loading-state strategy keeps the snappy first paint for built-in tiers.)

### Scenario 23: Built-in MEMBER sees "no permission" immediately
1. Log in as MEMBER. Try direct nav to `/admin/users`.
2. **Expect:** redirect to `/dashboard` immediately (no spinner detour either — the legacy fallback is accurate for MEMBER).

---

## Section 9 — Audit trail (Gap 7)

### Scenario 24: Role assignment writes audit event
1. Make any role change.
2. Check audit log (via your audit viewer or directly: `GET /orgs/current/audit-events`).
3. **Expect** an entry:
   ```
   action: "user.role_changed"
   summary: "Changed role of {user} from {oldRole} to {newRole}"
   metadata.role_permissions_at_assignment: [<full permission list>]
   ```

### Scenario 25: Audit survives later role edit
1. Note the permissions snapshotted in the entry from Scenario 24.
2. Edit the Tester role to add/remove permissions.
3. Re-read the audit entry.
4. **Expect:** the snapshot in the audit entry is **unchanged** (records what the role granted at the moment of assignment, not what it currently grants).

---

## Section 10 — Backend isolation

### Scenario 26: Cross-tenant role isolation
1. (Requires a second tenant on staging — skip if you don't have one.)
2. Create a role `tester` in tenant A.
3. Try to use `tester` role_id from tenant B's API: `PATCH /users/role` with `system_role: "tester"`.
4. **Expect:** 400 *"Invalid target role: tester"* — tenant B's `list_roles` doesn't return tenant A's records.

### Scenario 27: Backend test suite
From `backend/`:
```bash
pytest
```
**Expect:** all tests pass, particularly `test_domain_user.py::test_custom_role_string_accepted` and `::test_empty_role_falls_back_to_member`.

---

## Quick smoke (5 minutes if pressed for time)

If you don't have time for all 27, run these in order:
1. Scenario 1 (create tester)
2. Scenario 2 (assign)
3. Scenario 3 (login, verify sidebar)
4. Scenario 11 (custom roleManager)
5. Scenario 17 (block deletion of referenced role)
6. Scenario 24 (audit entry)

If those 6 pass, the feature is solid end-to-end. Anything that fails — note which scenario # and the exact symptom for follow-up.

---

## Coverage map

| Gap (from CUSTOM-ROLES-REMAINING.md) | Scenarios that exercise it |
|---|---|
| Gap 1 (bulk CSV) | 10 |
| Gap 2 (token staleness) | 4, 5 (live propagation via 60s polling) |
| Gap 3 (ProjectList Create button) | 13 |
| Gap 4 (canManageAdmins for custom roles) | 11 |
| Gap 5 (project-scope custom roles) | NOT COVERED — open work |
| Gap 6 (delete blocked when referenced) | 17 |
| Gap 7 (audit snapshot) | 24, 25 |
| Permission catalog drift | 3, 5 (custom permissions resolve) |
| Loading polish | 21, 22, 23 |
| Owner safety | 14, 15, 16, 18 |
| Cross-tenant isolation | 26 |
