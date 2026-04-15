# Phase 1 — Staging Deploy Runbook

End-to-end checklist for deploying the SaaS migration Phase 1 to the staging stack and verifying everything works before touching production.

**Target environment:**
- AWS account: `giri-dev` (personal), region `ap-south-1`
- CDK stack: `task-management-staging`
- DynamoDB table: `TaskManagementTable-staging`
- Cognito pool: `TaskManagementUserPool-staging`
- Profile: **default** (no `--profile` flag)

**Prod (`--profile company`) is NOT touched anywhere in this runbook.**

---

## 0. Pre-flight

Run each of these and confirm before starting. Any failure aborts the deploy.

```bash
# Confirm you're on the saas-migration branch with a clean working tree
cd d:/NEUROSTACK/PROJECTS/task-management
git status
git branch --show-current    # expect: saas-migration
git log --oneline -5

# Confirm AWS credentials point at the personal account
aws sts get-caller-identity
# expect: Account "013484737418", Arn "...user/giri-dev"

# Confirm the existing staging resources
aws dynamodb describe-table --table-name TaskManagementTable-staging --query 'Table.TableStatus'
# expect: "ACTIVE"

aws cognito-idp list-user-pools --max-results 20 | grep TaskManagementUserPool-staging
# expect: one matching pool, note its Id (looks like ap-south-1_XXXXXXXXX)
```

Write down the staging pool ID for later use:

```
STAGING_POOL_ID=ap-south-1_____________
```

---

## 1. (Optional) Restore a prod clone into the staging table

Do this if you want the backfill to run against realistic data. Skip if staging already has enough test data and you trust the backfill script's logic.

> ⚠️ This is the ONLY step that touches prod (via a read-only PITR restore).
> It creates a new staging table; it does not modify the prod table.

```bash
# Take a PITR snapshot of prod and restore into a temporary name
aws dynamodb restore-table-to-point-in-time \
  --source-table-name TaskManagementTable \
  --target-table-name TaskManagementTable-staging-clone \
  --use-latest-restorable-time \
  --profile company

# Wait for ACTIVE status (can take 5-15 minutes for small tables)
aws dynamodb describe-table --table-name TaskManagementTable-staging-clone \
  --query 'Table.TableStatus' --profile company
```

Then either (a) point the staging stack's `TABLE_NAME` at the clone via env override, or (b) manually copy items from the clone to the real staging table. Option (b) is simpler:

```bash
# Quick sanity: how many items in the clone?
aws dynamodb scan --table-name TaskManagementTable-staging-clone \
  --select COUNT --profile company --query Count

# (If you're doing a big migration, write a separate copy script.
#  For Phase 1 smoke testing, staging already has enough data.)
```

If you skip this step, the backfill runs against whatever is currently in `TaskManagementTable-staging`.

---

## 2. CDK deploy

This applies all the Phase 1 backend changes to the staging stack:

- `custom:orgId` attribute added to the Cognito pool schema
- Pre-token-generation Lambda trigger attached
- New `POST /signup`, `GET /orgs/by-slug/{slug}`, `GET /orgs/current` routes
- 8 existing context handlers redeployed with dual-write code

```bash
cd d:/NEUROSTACK/PROJECTS/task-management/backend/cdk

# Synth first — catches any CDK errors without touching AWS
cdk synth --app "python app_staging.py"

# Preview what will change (read-only)
cdk diff --app "python app_staging.py"
# review the diff — expect:
#   + Lambda::Function PreTokenTrigger
#   + Lambda::Function SignupOrg
#   + Lambda::Function GetOrgBySlug
#   + Lambda::Function GetCurrentOrg
#   + Cognito::UserPool (modified: LambdaConfig.PreTokenGeneration, Schema adds orgId)
#   + ApiGateway::Method (POST /signup)
#   + ApiGateway::Method (GET /orgs/by-slug/{slug})
#   + ApiGateway::Method (GET /orgs/current)
#   ... (and redeploys to all 32 existing Lambdas because the asset hash changes)

# Actually deploy
cdk deploy --app "python app_staging.py" --require-approval never
```

Expected duration: **3–8 minutes**.

### Verify the deploy

```bash
# Confirm the new routes exist
aws apigateway get-rest-apis --query "items[?name=='TaskManagementApi'].id" --output text
# note the API ID, then:
aws apigateway get-resources --rest-api-id <API_ID> \
  --query "items[?pathPart=='signup' || pathPart=='by-slug' || pathPart=='current'].{path:path,method:resourceMethods}"

# Confirm the pre-token trigger is attached
aws cognito-idp describe-user-pool --user-pool-id $STAGING_POOL_ID \
  --query 'UserPool.LambdaConfig'
# expect: {"PreTokenGeneration": "arn:aws:lambda:ap-south-1:...:function:...-PreTokenTrigger..."}

# Confirm custom:orgId is in the pool schema
aws cognito-idp describe-user-pool --user-pool-id $STAGING_POOL_ID \
  --query 'UserPool.SchemaAttributes[?Name==`orgId`]'
# expect: one entry with StringAttributeConstraints MinLength=1 MaxLength=64
```

---

## 3. DynamoDB backfill — DRY RUN first

Always dry-run before the real thing.

```bash
cd d:/NEUROSTACK/PROJECTS/task-management/backend
python scripts/backfill_neurostack.py \
  --table TaskManagementTable-staging \
  --dry-run
```

Expected output at the end:

```
--- Backfill summary ---
Scanned total items         : N
Already in v2 format (skip) : 0  (first run — all items are legacy)
Unknown PK/SK shape (skip)  : 0
Already existed (idempotent): 0  (dry-run never hits put_item)
New v2 items written        : ~N
By kind:
  attendance    : ?
  comment       : ?
  dayoff        : ?
  ...
```

**If any "Unknown PK/SK shape" appears in the summary, STOP** and investigate — either the classifier is missing a case or the table has items the migration doesn't know about.

---

## 4. DynamoDB backfill — LIVE

```bash
python scripts/backfill_neurostack.py --table TaskManagementTable-staging
```

Expected: all the counts from the dry-run, but this time the writes actually land. `Already existed (idempotent)` will be 0 on first run; re-running is safe and will show equal numbers (every v2 item is skipped via `ConditionExpression`).

### Spot check

```bash
# Verify the org record landed
aws dynamodb get-item --table-name TaskManagementTable-staging \
  --key '{"PK":{"S":"ORG#neurostack"},"SK":{"S":"ORG"}}'
# expect: an Item with org_id=neurostack, slug=neurostack, plan_tier=ENTERPRISE

# Verify a sample user was rewritten under the new PK
aws dynamodb scan --table-name TaskManagementTable-staging \
  --filter-expression "begins_with(PK, :p) AND SK = :s" \
  --expression-attribute-values '{":p":{"S":"ORG#neurostack#USER#"},":s":{"S":"PROFILE"}}' \
  --select COUNT
# expect: Count equal to the number of users in the legacy format

# Verify the slug resolver record
aws dynamodb get-item --table-name TaskManagementTable-staging \
  --key '{"PK":{"S":"SLUG#neurostack"},"SK":{"S":"ORG"}}'
# expect: an Item pointing at org_id=neurostack
```

---

## 5. Cognito backfill — DRY RUN

Set `custom:orgId=neurostack` on every existing user in the staging pool.

```bash
python scripts/backfill_cognito.py \
  --user-pool-id $STAGING_POOL_ID \
  --dry-run
```

Expected:

```
[DRY-RUN] Target Cognito pool: ap-south-1_XXXXXXXXX
[DRY-RUN] Setting custom:orgId = 'neurostack' on every user missing it

Pool name: TaskManagementUserPool-staging
Estimated users: N

  [DRY] would set custom:orgId='neurostack' for <username>
  ...

--- Cognito backfill summary ---
Users scanned                  : N
Already had custom:orgId (skip): 0
Updated (set custom:orgId)     : N
```

---

## 6. Cognito backfill — LIVE

```bash
python scripts/backfill_cognito.py --user-pool-id $STAGING_POOL_ID
```

### Spot check

```bash
# Pick any user from the pool and verify the attribute landed
aws cognito-idp list-users --user-pool-id $STAGING_POOL_ID --limit 1 \
  --query 'Users[0].Username' --output text
# copy that username, then:
aws cognito-idp admin-get-user --user-pool-id $STAGING_POOL_ID --username <USERNAME> \
  --query 'UserAttributes[?Name==`custom:orgId`]'
# expect: [{"Name": "custom:orgId", "Value": "neurostack"}]
```

---

## 7. Frontend deploy

Build and deploy the frontend from the `saas-migration` branch to whichever static host staging uses (Vercel preview, CloudFront, or `npm run dev` locally for manual testing).

For local smoke testing, set the staging API URL + pool ID in `.env.local`:

```bash
cd d:/NEUROSTACK/PROJECTS/task-management/frontend

# Get the staging API URL from CDK outputs
cd ../backend/cdk && cdk list --app "python app_staging.py"
# then describe the deployed stack:
aws cloudformation describe-stacks --stack-name task-management-staging \
  --query 'Stacks[0].Outputs'

# Create frontend/.env.local with:
#   NEXT_PUBLIC_API_URL=<ApiUrl from CDK outputs, WITHOUT trailing slash>
#   NEXT_PUBLIC_COGNITO_USER_POOL_ID=<staging pool id>
#   NEXT_PUBLIC_COGNITO_CLIENT_ID=<staging client id>

cd d:/NEUROSTACK/PROJECTS/task-management/frontend
npm install
npm run dev
# open http://localhost:3000
```

---

## 8. Smoke test — existing NEUROSTACK user still works

**Goal: verify zero regression for current users.**

- [ ] Open `http://localhost:3000/login` in a fresh browser profile (or incognito)
- [ ] Log in with an existing NEUROSTACK user's email + password
- [ ] Landing dashboard loads with all the same data they see today
- [ ] Open DevTools → Application → Local Storage: `auth_token` is set
- [ ] Decode the JWT at [jwt.io](https://jwt.io) — look for:
  - [ ] `custom:orgId: "neurostack"` ← **this is the Phase 1 success criterion**
  - [ ] `custom:systemRole: ...`
  - [ ] `custom:employeeId: ...`
- [ ] Create a task, sign in/out of the timer, submit a day-off request, view reports
- [ ] All features work identically to pre-deploy

If any of these fail, **STOP and investigate**. Check:
- CloudWatch logs for the Lambda function that handled the failing request
- The dual-write in the relevant context repository
- Whether the backfill script wrote the expected v2 items (scan for `ORG#neurostack#...`)

---

## 9. Smoke test — sign up a second org and verify isolation

**Goal: prove tenant isolation actually works.**

- [ ] Open a second browser profile (or a different incognito window)
- [ ] Navigate to `http://localhost:3000/signup`
- [ ] Fill in:
  - Company name: `Acme Inc`
  - Workspace code: `acme` (WorkspaceField should show "✓ Available")
  - Your name: `Test Owner`
  - Email: `owner@acme-test.com` (must not already exist in the pool)
  - Password: a strong one
- [ ] Click **Create workspace**
- [ ] Browser redirects to `/login?workspace=acme&first_login=1`
- [ ] In the staging API logs / CloudWatch: confirm one POST /signup returned 201

Currently the signup handler does NOT actually create a Cognito user (Phase 1 intentionally left `cognito_service=None`). The acme organization exists in DynamoDB but has no Cognito user yet.

**For the isolation test, we can only check at the DynamoDB layer:**

```bash
# Confirm the acme org records exist
aws dynamodb get-item --table-name TaskManagementTable-staging \
  --key '{"PK":{"S":"SLUG#acme"},"SK":{"S":"ORG"}}'
# expect: Item with org_id=org_XXXX

aws dynamodb query --table-name TaskManagementTable-staging \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"ORG#<that org_id>"}}'
# expect: 6 items (ORG, SETTINGS, PLAN, 3x ROLE)
```

- [ ] Confirm no `ORG#org_XXXX#USER#...`, `ORG#org_XXXX#PROJECT#...`, etc. items exist (acme has no tasks/users yet)
- [ ] Confirm the NEUROSTACK user still cannot see any `org_XXXX` data in their API responses (their JWT `custom:orgId=neurostack`, which the dual-write reads still scope to via the legacy PKs — but the eventual Step 10 read flip will enforce this at the repository layer)

Phase 2 will add the invite flow and actually create Cognito users for new org owners. For Phase 1, the isolation test is "the records for both orgs coexist and don't collide on any PK/SK."

---

## 10. The Phase 1 gate checklist

Before moving to Step 10 (flip reads to v2), confirm **every** box below:

- [ ] CDK deploy completed successfully, `cdk diff` shows no pending changes
- [ ] Pre-token trigger fires on login (verified via JWT `custom:orgId` claim)
- [ ] DynamoDB backfill: 0 "Unknown PK/SK shape" items, 0 errors
- [ ] Idempotency check: running `backfill_neurostack.py` twice → second run shows ALL items as "Already existed"
- [ ] Cognito backfill: 0 errors, every user now has `custom:orgId=neurostack`
- [ ] Existing NEUROSTACK user can log in, see their data, and use every feature (tasks/timer/day-off/reports/activity)
- [ ] CloudWatch: no new error-rate spikes on any Lambda for ≥24h of synthetic use
- [ ] Acme signup succeeded at the DynamoDB layer
- [ ] New org's records are fully isolated from NEUROSTACK's records (no cross-contamination visible in any scan)
- [ ] Rollback rehearsal: deliberately revert the last deploy on staging → app still works

Only when every box is checked do we proceed to Step 10.

---

## Rollback procedures

### Roll back the CDK deploy

```bash
cd d:/NEUROSTACK/PROJECTS/task-management/backend/cdk
# Check out main temporarily (has the pre-Phase-1 stack.py)
git stash
git checkout main
cdk deploy --app "python app_staging.py"
# restore saas-migration
git checkout saas-migration
git stash pop
```

The DynamoDB table and its data are not destroyed — only Lambdas and API routes revert.

### Roll back the DynamoDB backfill

The backfill is additive — it never modifies legacy items, only adds new org-scoped copies. So "rolling back" means deleting the v2 items:

```bash
# WRITE A CLEANUP SCRIPT before running this manually. Deleting by
# scan is slow but safe:
# - filter for items where PK starts with "ORG#" or "SLUG#"
# - delete them in a batch_writer loop
# - verify legacy items (PK starts with USER# / PROJECT# / TASK# / TASKUPDATE#) remain untouched
```

Or if you restored staging from a prod clone (Section 1), just drop and re-restore the staging table.

### Roll back the Cognito backfill

`custom:orgId` is mutable, so you can clear it by setting it to an empty string:

```bash
# Set an empty value — this effectively removes it (AuthContext falls
# back to "neurostack" via DEFAULT_ORG_ID)
aws cognito-idp admin-update-user-attributes \
  --user-pool-id $STAGING_POOL_ID \
  --username <USERNAME> \
  --user-attributes Name=custom:orgId,Value=""
```

---

## Where to look when something breaks

| Symptom | Check |
|---------|-------|
| Login fails on an existing user | CloudWatch logs for `PreTokenTrigger` Lambda |
| 500 from `/signup` | CloudWatch logs for `SignupOrg` Lambda, check for DynamoDB permission errors |
| Existing user's data is gone | DO NOT run any rollback yet. Scan the table for their user_id. The dual-write means legacy items should still exist. Check `/users/me` handler logs. |
| Backfill errors | `python scripts/backfill_neurostack.py --table ... --progress 10` (verbose) and check the last N items printed before the error |
| Second org's data leaks into first | Phase 1 reads are still on legacy keys, so this shouldn't happen. If it does, check `AuthContext.org_id` is being read correctly and the pre-token trigger is injecting the claim. |
| Can't deploy — "no credentials" | `aws sts get-caller-identity` — confirm you're on the personal account (giri-dev), NOT prod (company) |

---

## After the gate is green

Move to Step 10: flip reads from legacy to v2 keys and remove the dual-write code. That's a code change (not operational) and I'll handle it on your say-so.
