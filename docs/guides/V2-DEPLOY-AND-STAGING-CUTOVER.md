# V2 Deploy & Staging Cutover — Walkthrough

> **Status: HISTORICAL (mission accomplished 2026-04-30).**
> V2 deploy completed and the personal-account staging stack was destroyed
> on 2026-04-30. This doc is kept as a reference for the approach used —
> its commands no longer correspond to live infrastructure.
>
> For current operational guidance see [INTEGRATIONS-RUNBOOK.md](INTEGRATIONS-RUNBOOK.md).

---

Deploy `taskflow-v2` to the company AWS account (with the integration
platform enabled), repoint the Vercel frontend at it, then tear down the
old staging stack on the personal account. End state: one isolated
deployment, on the company account, separate from the existing prod
`taskflow` stack.

Pair with:
- [COMPANY-V2-DEPLOYMENT-PLAN.md](../planning/COMPANY-V2-DEPLOYMENT-PLAN.md) — strategy + risks.
- [INTEGRATIONS-STAGING-DEPLOY.md](INTEGRATIONS-STAGING-DEPLOY.md) — the original staging deploy steps (now superseded for the integration platform; superseded sections are noted below).

---

## ⚠ Read this first

**Three things to acknowledge before pressing Enter:**

1. **Two prod-account stacks coexist after this deploy.** `taskflow` (the live prod stack — untouched) and `taskflow-v2` (this new one). `cdk deploy` creates a NEW stack — it does not touch `taskflow`. Verified by `cdk diff --app "python app_company.py"` printing zero changes.

2. **Staging data WILL be lost.** Once you delete the personal-account staging stack:
   - **Cognito user pool** `TaskManagementUserPool-staging` deletes → all the test users (incl. the one we used to log in) are gone.
   - **DynamoDB table** `TaskManagementTable-staging` deletes (RemovalPolicy.DESTROY in staging) → all the test tasks/projects/etc. gone.
   - **S3 bucket** `taskflow-uploads-staging` retains by default; can be force-deleted manually if you want it gone.
   - **The integration KMS key** has `RemovalPolicy.RETAIN` — `cdk destroy` leaves it; you'd schedule its deletion separately if you want a clean wipe.

   Translation: V2 starts with **zero users, zero data**. Everyone signs up fresh against the new Cognito pool.

3. **The Vercel frontend will need three env vars updated** to point at V2 (otherwise it keeps calling the about-to-be-deleted staging API and breaks).

---

## Step 1 — Pre-deploy checks (~3 min)

Run from `backend/cdk/`. Each check must pass before `cdk deploy`.

### 1.1 — S3 bucket name globally available

```bash
aws s3api head-bucket --bucket taskflow-ns-uploads-v2-prod --profile company 2>&1 | head
```

Must return `Not Found` / `404`. A `200` means the name is taken — pick a different bucket name in [app_company_v2.py](../../backend/cdk/app_company_v2.py) and try again.

### 1.2 — Stack name is free

```bash
aws cloudformation describe-stacks --stack-name taskflow-v2 --profile company --region ap-south-1 2>&1 | head
```

Must return `Stack with id taskflow-v2 does not exist`.

### 1.3 — DynamoDB table name is free

```bash
aws dynamodb describe-table --table-name TaskFlowTable-v2 --profile company --region ap-south-1 2>&1 | head
```

Must return `ResourceNotFoundException`.

### 1.4 — Synth succeeds

```bash
cdk synth --app "python app_company_v2.py" --profile company
```

Generates 4 CFN templates (parent + Org/Workflow/Integrations nested). Expect a deprecation warning about `logRetention` — cosmetic, ignore.

### 1.5 — Diff against existing prod stack — must be zero

```bash
cdk diff --app "python app_company.py" --profile company
```

Must report **no changes** to the existing `taskflow` stack. This is the safety check that proves V2 doesn't accidentally touch live prod.

### 1.6 — Verify the existing-app ARN isn't pasted by mistake

```bash
cdk synth --app "python app_company_v2.py" --profile company \
  | grep -c "0eos9sfk62frvq2uhxwn7aw5z4"
```

Must print `0`. (That hash is the EXISTING `taskflow` resource group; the V2 file uses a different one ending in `05pduit0lnubyo3lv91e2n1l1f`.)

---

## Step 2 — Deploy (~5 min)

```bash
cd backend/cdk

# One-time bootstrap on the company account if not already done
cdk bootstrap --profile company

# Deploy
cdk deploy --app "python app_company_v2.py" --profile company --require-approval never
```

Expect ~3–5 minutes. CFN events will scroll for parent + Org / Workflow / Integrations nested stacks.

---

## Step 3 — Capture outputs (~2 min)

CDK prints the parent stack outputs at the end. Copy these:

```
taskflow-v2.ApiUrl                = ?
taskflow-v2.UserPoolId            = ?
taskflow-v2.UserPoolClientId      = ?
taskflow-v2.UploadsBucketName     = ?
taskflow-v2.CDNDomain             = ?
taskflow-v2.TableName             = ?
```

Then read the integration nested-stack outputs:

```bash
NESTED=$(aws cloudformation list-stacks --profile company --region ap-south-1 \
  --stack-status-filter CREATE_COMPLETE \
  --query "StackSummaries[?contains(StackName,'taskflow-v2-IntegrationsNestedStack')].StackName" \
  --output text | head -1)

aws cloudformation describe-stacks --stack-name "$NESTED" --profile company --region ap-south-1 \
  --query "Stacks[0].Outputs" --output table
```

Copy the `IntegrationsApiUrl` — you need it for the frontend env update in step 5.

---

## Step 4 — Verify isolation (~2 min)

Confirm V2 is genuinely isolated from the existing prod stack:

```bash
# Existing prod table count BEFORE
aws dynamodb scan --table-name TaskFlowTable --select COUNT --profile company --region ap-south-1
# Note the count.

# Sign up a test user against V2
curl -sS -X POST "<V2 ApiUrl>/signup" \
  -H "Content-Type: application/json" \
  -d '{"workspaceCode":"v2test","name":"V2 Test","email":"<your+v2test@email>","password":"TempPass123!","captchaToken":"dev-bypass"}'

# Check that the user landed in V2's table, not in prod's
aws dynamodb scan --table-name TaskFlowTable-v2 --select COUNT --profile company --region ap-south-1
# Should show 1+ items (the new user).

# Existing prod table count AFTER — must be unchanged
aws dynamodb scan --table-name TaskFlowTable --select COUNT --profile company --region ap-south-1
# Same count as before. If different, STOP — V2 is not isolated.
```

---

## Step 5 — Repoint Vercel + smoke-test the integrations API (~5 min)

In your Vercel staging project (the one currently pointing at the personal-account staging API), update env:

```
NEXT_PUBLIC_API_URL              = <V2 ApiUrl>
NEXT_PUBLIC_COGNITO_USER_POOL_ID = <V2 UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID    = <V2 UserPoolClientId>
NEXT_PUBLIC_AWS_REGION           = ap-south-1
NEXT_PUBLIC_INTEGRATIONS_API_URL = <V2 IntegrationsApiUrl, no trailing slash>
```

Trigger a Vercel redeploy.

After redeploy, log in as a fresh user against V2, copy the `auth_token`, and run the smoke test:

```bash
export INTEGRATIONS_API_URL="<V2 IntegrationsApiUrl>"
export TASKFLOW_JWT="<V2 auth_token>"
./scripts/integrations_smoke.sh
```

All four checks must pass.

---

## Step 6 — Optional: Freshdesk reconnect on V2

If you had Freshdesk connected on the staging stack, that connection lives in the about-to-be-deleted DDB table — it's gone. Reconnect on V2:

1. Settings → Integrations → Browse → Freshdesk → Connect.
2. Paste the same subdomain + API key (or create a fresh Freshdesk dev account).
3. Copy the new webhook URL + bearer.
4. Update the Workflow Automator rule in Freshdesk with the new URL + bearer.

(The old V2 webhook URL has a different API Gateway ID, so the Freshdesk rule that pointed at staging will need its URL replaced.)

---

## Step 7 — Tear down the staging stack (~3 min)

**Only after V2 is verified working end-to-end.** This is irreversible for the data.

```bash
cd backend/cdk
cdk destroy --app "python app_staging.py"   # default profile (personal account)
```

CDK prompts for confirmation. Type `y`.

`cdk destroy` removes the CloudFormation stack and its resources. The data layer:

- **DynamoDB table** `TaskManagementTable-staging` → DELETED (RemovalPolicy.DESTROY in staging).
- **Cognito user pool** `TaskManagementUserPool-staging` → DELETED.
- **S3 bucket** `taskflow-uploads-staging` → DELETED if the bucket is empty; remaining objects abort the destroy. Empty manually first if it has objects:
  ```bash
  aws s3 rm s3://taskflow-uploads-staging --recursive
  ```
- **Integration KMS key** → RETAINED by `RemovalPolicy.RETAIN`. CDK destroy leaves it. To wipe:
  ```bash
  aws kms schedule-key-deletion \
    --key-id 550501be-f6da-4acd-9048-2c3595097207 \
    --pending-window-in-days 7
  ```
  (Replace with the key ID captured during the staging deploy. Goes into 7-day deletion grace; cancel anytime within that window.)
- **CloudFront distribution** → DELETED (slow; 15+ minutes on AWS's side).
- **Lambda log groups** → kept under their own retention policy; clean up manually if you want them gone.

---

## Step 8 — Confirm staging is gone

```bash
aws cloudformation describe-stacks --stack-name task-management-staging --region ap-south-1 2>&1 | head
```

Must return `Stack with id task-management-staging does not exist`. If it lists the stack with status `DELETE_FAILED`, check CloudFormation events for which resource refused to delete and clean up by hand.

---

## Verification checklist

- [ ] Step 1 — all 6 pre-deploy checks pass.
- [ ] Step 2 — `cdk deploy` exits 0; CFN console shows `taskflow-v2` as `CREATE_COMPLETE`.
- [ ] Step 3 — captured `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `IntegrationsApiUrl`.
- [ ] Step 4 — fresh user lands in `TaskFlowTable-v2`; existing `TaskFlowTable` count unchanged.
- [ ] Step 5 — Vercel env updated; smoke test passes; Freshdesk catalog shows on V2 frontend.
- [ ] Step 6 — Freshdesk reconnected on V2 (if applicable); test ticket creates a TaskFlow task.
- [ ] Step 7 — staging stack destroyed cleanly.
- [ ] Step 8 — `describe-stacks` confirms staging is gone.

When every box is ticked, V2 is the live prod-account environment for everything that wasn't on the existing `taskflow` stack, and the personal-account staging deployment is decommissioned.

---

## Rollback paths

| Failure point | What to do |
|---|---|
| Pre-deploy checks fail (1.1–1.6) | Stop. Fix the underlying issue (rename bucket, etc.) and rerun. Don't `cdk deploy`. |
| `cdk deploy` rolls back | CFN auto-rolls back to pre-deploy state. The existing `taskflow` prod stack is untouched. Investigate the failure in CloudFormation events; common cause is a service-quota limit (Lambda concurrency, KMS key allowance). |
| Smoke test fails after deploy | Don't tear down staging yet. Diagnose against V2 logs first; staging is still alive as a comparison environment. |
| V2 looks wrong, want to start over | `cdk destroy --app "python app_company_v2.py" --profile company`. Stack and most resources go away cleanly; data layer (`RemovalPolicy.RETAIN` on Cognito + KMS) survives — clean those manually. |
| Already destroyed staging when V2 has issues | You'll need to redeploy staging from scratch (`cdk deploy --app "python app_staging.py"`) and migrate users manually. Avoid this — verify V2 *fully* before step 7. |

---

## Pointers

- V2 strategy + risks: [COMPANY-V2-DEPLOYMENT-PLAN.md](../planning/COMPANY-V2-DEPLOYMENT-PLAN.md)
- Integration platform plan: [INTEGRATION-PLATFORM-PLAN.md](../planning/INTEGRATION-PLATFORM-PLAN.md)
- Operational runbook: [INTEGRATIONS-RUNBOOK.md](INTEGRATIONS-RUNBOOK.md)
- Smoke test: [scripts/integrations_smoke.sh](../../scripts/integrations_smoke.sh)
