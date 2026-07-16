# Prod → V2 Data Migration Plan

One-time migration of **all** data from the legacy `taskflow` (prod) deployment
into `taskflow-v2`: users, projects, tasks, comments, task updates, attendance,
activity, day-offs, and uploaded files.

> **This supersedes a prior non-goal.** [COMPANY-V2-DEPLOYMENT-PLAN.md §2](COMPANY-V2-DEPLOYMENT-PLAN.md)
> states *"**No** data migration between deployments — they're separate universes."*
> V2 was built as a clean-slate parallel stack. That constraint is deliberately
> lifted for this one-time migration; update §2 when this completes.

---

## 1. Current state (verified 2026-07-09)

| | **Source — `taskflow` (prod)** | **Target — `taskflow-v2`** |
|---|---|---|
| CFN stack | `taskflow` | `taskflow-v2` |
| DynamoDB | `TaskFlowTable` — **592 items**, 4.9 MB | `TaskFlowTable-v2` — 34 items |
| Cognito | `ap-south-1_KvHp1RVEE` — **20 users** | `ap-south-1_yWxQYrYXp` — 7 users |
| S3 | `taskflow-ns-uploads-prod` — **5,683 objects / 534 MB** | `taskflow-ns-uploads-v2-prod` — 0 |
| CDN | `dp2uotzxlo5a5.cloudfront.net` | `d2fo333r5g6kfp.cloudfront.net` |
| API | `qhh92ze0rc` | `mcx0iyvisf` |
| **Schema** | **legacy single-tenant** | **multi-tenant (org-scoped)** |

Both stacks live in the same AWS account (`896823725438`, `ap-south-1`, profile
`company`). This is a **cross-stack**, same-account migration — *not* the
account-to-account scenario in [ACCOUNT-MIGRATION-GUIDE.md](../guides/ACCOUNT-MIGRATION-GUIDE.md)
(that guide is also stale: it references `TaskManagementTable`). Its *mechanics*
still apply and informed this plan.

### Prod item inventory (592)

`ACTIVITY` ×191 · `ATTENDANCE` ×191 · `USER` ×129 (TASKUPDATE SKs) · `MEMBER` ×23 ·
`PROFILE` ×20 · `TASK` ×20 · `METADATA` ×7 (projects) · `COMMENT` ×6 · `DAYOFF` ×5

**Prod has zero `ORG`/`SETTINGS`/`PLAN`/`ROLE`/`PIPELINE`/`SLUG` items** — it never
went through the SaaS multi-tenant conversion.

### Key shape: legacy → v2

| Legacy (prod) | V2 (target) |
|---|---|
| `USER#{sub}` / `PROFILE`·`ACTIVITY#{d}`·`ATTENDANCE#{d}`·`DAYOFF#…` | `ORG#{org}#USER#{sub}` / *same SK* |
| `PROJECT#{pid}` / `METADATA`·`MEMBER#{uid}`·`TASK#{tid}` | `ORG#{org}#PROJECT#{pid}` / *same SK* |
| `TASK#{tid}` / `COMMENT#…` | `ORG#{org}#TASK#{tid}` / *same SK* |
| `TASKUPDATE#{date}` / `USER#{uid}#{uuid}` | `ORG#{org}#TASKUPDATE#{date}` / *same SK* |
| *(none)* | `ORG#{org}` / `ORG`·`SETTINGS`·`PLAN`·`ROLE#…`·`PIPELINE#…` |
| *(none)* | `SLUG#{slug}` / `ORG` |

---

## 2. The four hard problems

1. **Schema transform.** Every legacy key must be rewritten org-scoped, and the
   org scaffolding must be synthesized from nothing.
2. **Cognito subs change.** The `sub` is the identity key (`USER#{sub}`) across
   PKs, SKs, GSI keys, and *attributes* (`assigned_to`, `created_by`,
   `owner_user_id`, `user_id`). New pool → new subs → every reference rewritten.
3. **Passwords cannot be exported.** Solved with a migration Lambda trigger (below).
4. **Email collisions.** 6 of prod's 20 emails already exist in v2 — 4 exact
   (`kiranparthiban2004@`, `kishoremurthi12@`, `sakthimahendran.kannan@`,
   `taskflow.neurostack@`) + 2 case-variants (`Arshisayyed243@` vs `arshisayyed243@`,
   `Rahulbalakrishnan2020@` vs `rahulbalakrishnan2020@`). Email is globally unique
   (`GSI1PK=USER_EMAIL#{email}`), so a naive load would fail. Solved by wiping v2.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| V2 target state | **Wipe v2 clean first** — delete all items + all 7 Cognito users, then load prod wholesale. Removes all 6 collisions. |
| Passwords | **Force password reset** — every user gets a temporary password and sets their own on first login. |
| Consistency | **Freeze prod** during migration — point-in-time snapshot, no delta pass. |
| Org identity | `org_id = "neurostack"`, `slug = "neurostack"` (matches `DEFAULT_ORG_ID` and the backfill script's `DEFAULT_SLUG`). |
| Plan tier | **ENTERPRISE** (current default for new orgs). |

> **Why not the Cognito migration Lambda trigger?** It was the original choice,
> but it is **incompatible with this migration**. The trigger only fires when a
> user does **not** exist in the pool (`USER_NOT_FOUND` at sign-in). We must
> pre-create all 20 users to learn their new `sub`s — those subs are the identity
> key rewritten across all 593 items. Pre-created users ⇒ the trigger never
> fires; no pre-creation ⇒ no subs ⇒ the data migration can't be built at all.
> Cognito also forbids setting `sub` on create and cannot import passwords, so
> force-reset is the only workable option. Note Cognito's *forgot-password* also
> rejects users in `FORCE_CHANGE_PASSWORD`, so the reset must be seeded by an
> admin `admin_set_user_password` (temporary), which the web app then completes
> via its `NEW_PASSWORD_REQUIRED` flow.

## 4. Guardrails

- **Prod is READ-ONLY for the entire migration.** No writes to `TaskFlowTable`,
  the prod pool, or the prod bucket. Every prod operation is `scan` / `list` /
  `get` / `s3 cp` (read side).
- The one ongoing prod dependency is the **migration Lambda trigger**, which
  *authenticates against* the prod pool (`AdminInitiateAuth`). It reads; it never
  mutates prod.
- This plan requires explicit authorization to read legacy prod, per the
  `no-touch-legacy-taskflow` rule. **It does not "cut over to legacy prod"** —
  prod keeps serving its users until a separate cutover decision.
- V2 is disposable: any failure ⇒ re-wipe and re-run. Prod is never at risk.

---

## 5. Phases

### Phase 0 — Prep & backup (~30 min)

- **Back up prod** before anything: on-demand DynamoDB backup of `TaskFlowTable`
  (`aws dynamodb create-backup`) — cheap insurance even though we only read.
- Snapshot the source inventory (counts above) to compare against post-load.
- Confirm `backend/scripts/` tooling runs with `AWS_PROFILE=company`.

### Phase 1 — Freeze prod (~10 min)

- Announce the maintenance window; stop user writes to prod.
- Optional hard stop: set prod org/app to a read-only or maintenance state, or
  simply coordinate the window. Record the freeze timestamp — everything after it
  is out of scope for this snapshot.

### Phase 2 — Wipe v2 (~5 min)

- Delete **all** items from `TaskFlowTable-v2` (scan → batch delete).
- Delete **all** users from the v2 pool `ap-south-1_yWxQYrYXp` (currently 7).
- Empty `taskflow-ns-uploads-v2-prod`.
- Verify all three are zero before loading.

### Phase 3 — Cognito user migration + sub map (~30 min)

For each of the 20 prod users:
1. Read prod attributes (`email`, `name`, `custom:*`, `email_verified`).
2. `admin_create_user` in the v2 pool with `MessageAction=SUPPRESS` (no email —
   the migration trigger handles first login) and matching attributes.
3. Set `custom:orgId = "neurostack"` and `custom:systemRole` from the prod PROFILE.
4. Capture the **new sub**.

Output: **`sub_map.json` — `{old_sub: new_sub}` for all 20 users.** This file is
the backbone of Phase 4; treat it as the migration's source of truth and keep it.

> Normalize emails to lowercase on create — prod contains mixed-case addresses
> (`Arshisayyed243@`, `Rahulbalakrishnan2020@`) which must not produce duplicate
> `USER_EMAIL#` GSI keys.

### Phase 4 — DynamoDB transform + load (~30 min)

**Extend `backend/scripts/backfill_neurostack.py`** — it already does the hard
part (`classify_item()` + `transform_item()` cover every legacy pattern, and it
synthesizes ORG/SETTINGS/PLAN/ROLE/SLUG). It needs three changes:

1. **Cross-table**: split `--table` into `--source-table TaskFlowTable` and
   `--target-table TaskFlowTable-v2` (today source == target for in-place backfill).
2. **Sub remapping**: accept `--sub-map sub_map.json` and rewrite every old sub →
   new sub in:
   - PK `USER#{sub}` → `ORG#{org}#USER#{new}`
   - SK `MEMBER#{sub}`, SK `USER#{sub}#{uuid}` (TASKUPDATE)
   - attributes: `assigned_to[]`, `created_by`, `owner_user_id`, `user_id`
   - GSI keys carrying a sub
3. **Plan tier**: ensure the synthesized `PLAN` is **ENTERPRISE** (script may
   default FREE).

Keep its existing safety properties: **idempotent** (`attribute_not_exists(PK) AND
attribute_not_exists(SK)`), **`--dry-run`**, resumable.

Run order: `--dry-run` first, diff the projected output, then execute.

### Phase 5 — S3 copy + rekey (~30–60 min, 534 MB / 5,683 objects)

Prod keys are **un-prefixed**: `screenshots/{oldSub}/{uuid}.jpg`.
V2 keys are org-scoped: `orgs/{orgId}/screenshots/{newSub}/{uuid}.jpg`.

So this is **not** an `aws s3 sync`— every key is rewritten:

```
screenshots/{oldSub}/{f}  →  orgs/neurostack/screenshots/{newSub}/{f}
```

Server-side `copy_object` within the same account/region (no download/upload).
Drive it from `sub_map.json`; log any object whose sub isn't in the map.

### Phase 6 — Rewrite screenshot URLs inside ACTIVITY items

Each `ACTIVITY#{date}` item stores a `buckets` JSON blob whose entries carry
`screenshot_url` pointing at the **legacy CDN**. These must be rewritten to the
v2 CDN **and** the new key:

```
https://dp2uotzxlo5a5.cloudfront.net/screenshots/{oldSub}/{f}
  → https://d2fo333r5g6kfp.cloudfront.net/orgs/neurostack/screenshots/{newSub}/{f}
```

Miss this and every migrated screenshot 404s in the UI. Fold it into the Phase 4
transform (it owns `sub_map` + the org id) rather than a separate pass.

### Phase 7 — Attach the migration Lambda trigger (~30 min)

- Add a `UserMigration` trigger to the v2 pool that, on first sign-in, calls
  `AdminInitiateAuth` against the prod pool `ap-south-1_KvHp1RVEE`; on success it
  provisions the user in v2 with the supplied password.
- Because Phase 3 pre-created all 20 users, the trigger's job is limited to
  password adoption on first login.
- Grant the trigger IAM read/auth on the prod pool only.
- **Keep the prod pool alive 2–4 weeks** until everyone has logged in once.

### Phase 8 — Verification (gate before declaring done)

- **Counts**: `TaskFlowTable-v2` item count ≈ 592 + org scaffolding (ORG, SETTINGS,
  PLAN, 7×ROLE, 4×PIPELINE, SLUG). Every prod item accounted for or explicitly
  classified as skipped.
- **Per-type histogram** matches prod (ACTIVITY 191, ATTENDANCE 191, PROFILE 20,
  TASK 20, METADATA 7, COMMENT 6, DAYOFF 5, MEMBER 23, TASKUPDATE 129).
- **Cognito**: 20 users in the v2 pool; each with `custom:orgId=neurostack`.
- **No dangling subs**: grep the loaded table for any *old* sub — must be zero.
- **S3**: 5,683 objects under `orgs/neurostack/screenshots/`.
- **Functional**: log in as a migrated user (password migration trigger fires),
  load Projects / Tasks / Attendance / Reports, and confirm a **screenshot
  renders** (proves Phases 5+6).
- **Isolation**: prod table/pool/bucket counts unchanged from Phase 0.

### Phase 9 — Post-migration

- Users now live on v2. The web app and desktop already point at v2
  (`mcx0iyvisf`, pool `yWxQYrYXp`, `v1.3.0`+).
- **Cutover of `taskflow.neurostack.in` and decommissioning legacy prod are
  explicitly out of scope** — separate decision, separate change.
- After burn-in (all users logged in ≥once), remove the migration trigger and
  retire the prod pool dependency.
- Update [COMPANY-V2-DEPLOYMENT-PLAN.md §2](COMPANY-V2-DEPLOYMENT-PLAN.md) to
  reflect that the no-migration non-goal was lifted.

---

## 6. Rollback

V2 is disposable and prod is read-only, so rollback is trivial: **re-wipe v2 and
re-run**. No prod state is mutated at any phase. The only irreversible act is
wiping v2's current 7 users / 34 items (Phase 2) — accepted per §3.

## 7. Deliverables

- `backend/scripts/sub_map.json` — old→new sub mapping (20 entries)
- `backend/scripts/migrate_prod_to_v2.py` — `cognito` / `data` / `s3` / `verify`
  steps, each with `--dry-run`
- Verification output (§8, below)

---

## 8. EXECUTED — 2026-07-09 (results)

**Status: complete and verified lossless.**

| Type | prod | v2 |
|---|---|---|
| ACTIVITY | 191 | 191 |
| ATTENDANCE | 191 | 191 |
| USER (taskupdate SKs) | 130 | 130 |
| MEMBER | 23 | 23 |
| PROFILE | 20 | 20 |
| TASK | 20 | 20 |
| METADATA (projects) | 7 | 7 |
| COMMENT | 6 | 6 |
| DAYOFF | 5 | 5 |

- **593/593 items migrated, `skipped=0`**; + 15 scaffolding = **608 items**
- **Dangling old subs: 0** · **Legacy CDN refs: 0**
- **S3: 5,665 objects** (5,663 screenshots + 2 avatars), `unmapped=0`.
  29 `releases/*` objects deliberately excluded — obsolete desktop installers
  from the retired S3 mirror; downloads come from GitHub Releases now.
- **Cognito: 20 users**, roles preserved (1 OWNER, 4 ADMIN, 15 MEMBER)
- Org `NEUROSTACK`/`neurostack`, ENTERPRISE, `owner_user_id` set
- Prod untouched (read-only) + backup `TaskFlowTable-pre-v2-migration-20260709`

### Bugs found during execution (all fixed)

1. **Avatar URLs** lost the `orgs/{org}/` path segment — the URL rewrite only
   handled `screenshots/`. Fixed to cover every `UPLOAD_PREFIXES` entry.
2. **Avatar files** were skipped entirely by the S3 step (it only matched
   `screenshots/`). Both avatars now migrate.
3. **Hand-rolled org scaffolding was wrong**: pipelines had **no `statuses`**
   (and used `is_system` instead of `is_default`), roles had **empty
   permissions**, and `team_lead` was scoped `system` instead of `project`.
   Fixed by building scaffolding from the real domain builders
   (`_role_record`, `_project_role_record`, `build_default_pipelines`,
   `OrgMapper.*`) — the same code the signup path uses. **Lesson: never
   hand-roll these records.**

### Follow-ups

- **Prod is still frozen.** Users can't work until they're pointed at v2 (or
  prod is unfrozen — but any prod write now makes v2 drift out of sync).
- Cutting over `taskflow.neurostack.in` and decommissioning legacy prod remain
  **out of scope** — separate decision.
- Update [COMPANY-V2-DEPLOYMENT-PLAN.md §2](COMPANY-V2-DEPLOYMENT-PLAN.md): the
  "no data migration between deployments" non-goal no longer holds.
