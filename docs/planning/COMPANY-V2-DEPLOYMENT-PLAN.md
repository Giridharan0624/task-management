# Company V2 — Parallel Deployment Plan

> **Status: COMPLETED 2026-04-30.** V2 (`taskflow-v2`) is deployed and live on the company AWS account, frontend repointed, integration platform live, and the personal-account staging stack was destroyed. This doc is kept for design reference; the resource names / outputs / risk table are still accurate for V2 going forward.
> **App name:** `taskflow-v2`
> **Frontend URL:** `https://taskflow-ns.vercel.app` *(see §4a — currently points at staging; must be re-pointed or replaced before V2 goes live)*
> **AWS Application ARN:** `arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow-v2/05pduit0lnubyo3lv91e2n1l1f`
> **AWS Account:** `896823725438` (`--profile company`)
> **Region:** `ap-south-1`
> **Integration platform:** **ON from day one** (§4b Option II). The staging backend that currently hosts the integration platform is being torn down once V2 is verified — V2 inherits the integrations role. The platform owns its OWN dedicated API Gateway, so it stays out of the parent stack's CFN budget.

A second, fully-isolated TaskFlow deployment in the same AWS account as the
existing prod stack. Zero shared resources. Zero edits to the running
`taskflow` stack, its DynamoDB table, its Cognito pool, or its S3 bucket.

---

## 1. Goal

Stand up a parallel deployment (`taskflow-v2`) running independently of
the existing prod deployment, so we can:

- Use it as a clean-slate environment for a new tenant or pilot
- Iterate on schema / behavior without prod risk
- Keep prod's data, auth, billing, and uptime untouched

## 2. Non-goals

- **No** data migration between deployments — they're separate universes
- **No** SSO / cross-deployment Cognito federation
- **No** shared infrastructure (table, bucket, secrets, user pool)
- **No** hot-failover relationship — independent stacks, not replicas

## 3. What must NOT change

The existing `app_company.py` deployment owns these resources. The plan
below produces zero diff against any of them.

| Resource type            | Identifier                                          |
| ------------------------ | --------------------------------------------------- |
| CloudFormation stack     | `taskflow`                                          |
| DynamoDB table           | `TaskFlowTable`                                     |
| Cognito user pool        | `TaskFlowUserPool`                                  |
| Cognito user pool client | `TaskFlowClient`                                    |
| S3 bucket                | `taskflow-ns-uploads-prod`                          |
| Secrets Manager          | `taskflow/gmail-credentials`, `taskflow/groq-api-key` |
| API Gateway stage        | `prod`                                              |
| App URL (CORS)           | `https://taskflow.neurostack.in`                    |
| AWS Application (tag)    | `arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow/0eos9sfk62frvq2uhxwn7aw5z4` |

Existing stack already carries `RemovalPolicy.RETAIN` on the table, the
user pool, and the bucket — so even an accidental `cdk destroy taskflow`
would leave the data behind. The new stack uses entirely separate names,
so no CFN-level path can touch the old resources.

## 4. New deployment identifiers

`v2` is **locked to `v2`** for this plan. The values below are the
canonical resource names — do not rename them after `cdk deploy` without
tearing down and rebuilding.

| Resource              | New value                                | Notes                                          |
| --------------------- | ---------------------------------------- | ---------------------------------------------- |
| Stack name            | `taskflow-v2`                            | CFN-unique within account                      |
| DynamoDB table        | `TaskFlowTable-v2`                       | DDB names unique per account-region            |
| Cognito user pool     | `TaskFlowUserPool-v2`                    | Pool itself gets its own `pool_id`             |
| Cognito client        | `TaskFlowClient-v2`                      |                                                |
| **S3 bucket**         | `taskflow-ns-uploads-v2-prod`            | **Globally unique across all of AWS** — verify |
| Secrets Manager       | `taskflow-v2/gmail-credentials`          | Created fresh; never share secrets cross-deploy|
|                       | `taskflow-v2/groq-api-key`               |                                                |
| API Gateway stage     | `prod`                                   | Stage name is per-API; no collision            |
| App URL (CORS)        | `https://taskflow-ns.vercel.app`         | See §4a — currently the staging frontend       |
| AWS Application (tag) | _new ARN, captured during step 5.1_      | Pasted into `app_company_v2.py`                |

## 4a. Frontend URL conflict — must resolve before V2 goes live

`https://taskflow-ns.vercel.app` is **already wired to staging** —
[backend/cdk/app_staging.py:6-11](../../backend/cdk/app_staging.py#L6-L11)
lists it as the staging `cors_origins` + `allowed_origin` + `app_url`,
and the Vercel project's `.env.production` points at the staging API.

A single Vercel deployment can only call one backend at a time. Pick one
of these before §10 (frontend wire-up):

- **Option A — Re-point the existing Vercel project at V2.**
  Replace `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_COGNITO_*` in the Vercel
  dashboard with the new V2 outputs. Staging frontend goes dark until you
  flip the env vars back. Cheapest, but staging and V2 cannot coexist.

- **Option B — Stand up a separate Vercel deployment for V2** (e.g.
  `taskflow-v2.vercel.app`, or a custom domain like
  `taskflow-v2.neurostack.in`). Staging keeps `taskflow-ns.vercel.app`;
  V2 gets its own URL. **Recommended** — keeps both environments live.

If Option B, update the V2 `cors_origins` / `allowed_origin` / `app_url`
in [§6](#6-code-changes) before deploying. The current §6 template
matches Option A.

## 4b. Integration platform — enable on V2?

The `integrations` bounded context (Freshdesk + future connectors) ships
with the codebase but is **opt-in per stage** via the `integrations_enabled`
flag. See [INTEGRATION-PLATFORM-PLAN.md](INTEGRATION-PLATFORM-PLAN.md) for the
full design and the additivity contract.

When **enabled**, the nested `IntegrationsNestedStack` adds (all isolated in
a sub-stack of the V2 CFN stack):

| Resource                      | Count | Notes                                                                            |
| ----------------------------- | ----- | -------------------------------------------------------------------------------- |
| **Dedicated REST API**        | 1     | Separate hostname from the main V2 API. Frontend uses `NEXT_PUBLIC_INTEGRATIONS_API_URL`. |
| Lambdas                       | 4     | admin_router / webhook_router / sync_worker / pusher (reserved concurrency)      |
| SQS queues                    | 2     | `integrations-sync-events` + DLQ; `integrations-outbound-jobs` + DLQ             |
| KMS CMK                       | 1     | Per-deployment; encrypts integration credentials with bound encryption context   |
| Cognito authorizer            | 1     | Binds to the V2 user pool (no new pool)                                          |
| Idle cost                     | ~$1/mo extra (KMS key + minimal Lambda invocations) on top of base V2 idle cost  |

When **disabled** (default for the initial V2 deploy): zero resources, zero
cost, zero impact. Pure additive feature.

**Three options for the initial V2 deploy:**

- **Option I — Defer integrations.** Leave `integrations_enabled` unset. V2 launches with the same surface as today's prod. Flip it on later when ready (§14). **Recommended for the initial deploy** — keeps the launch boring.
- **Option II — Enable from day one.** Set `integrations_enabled=True` in V2_CONFIG. V2 ships with the integration platform live; admins can connect Freshdesk on launch day. Costs an extra hostname and the resources above.
- **Option III — Enable later only after V2 is verified stable.** Same as Option I, but with a planned ramp date documented here.

If Option II, also set `NEXT_PUBLIC_INTEGRATIONS_API_URL` in the V2 Vercel
project (see §10) to the `IntegrationsApiUrl` CFN output captured at deploy.

## 5. AWS Application & resource group

### 5.1 — Create the application (one-time, in the AWS console)

Resource groups must exist before CDK can stamp resources with the tag —
CDK only labels existing resources, it doesn't create the application
container.

1. Open **Systems Manager → Application Manager → Create application**
   (or the `myApplications` console page).
2. **Name:** `taskflow-v2` (becomes the slug in the ARN).
3. **Description:** human-readable purpose, e.g.
   *"TaskFlow parallel V2 deployment — isolated from prod"*.
4. **Region:** `ap-south-1` (must match the stack region).
5. **Tag the application** with whatever extra book-keeping makes sense
   (e.g. `Environment=prod-v2`, `Owner=<team>`).
6. **Result:** AWS auto-creates the backing resource group and returns an
   ARN. Capture it — every CDK synth references it.

ARN format:

```
arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow-v2/<auto-generated-hash>
```

For comparison, the existing app's ARN is
`arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow/0eos9sfk62frvq2uhxwn7aw5z4` —
the new one will have slug `taskflow-v2` **and** a different trailing hash.

### 5.2 — How the tag flows

Every CDK construct in the new stack inherits the tag via a single
`cdk.Tags.of(stack).add(...)` line in the new app entry file. CFN passes
the tag down to every taggable resource — Lambda, IAM role, DynamoDB
table, S3 bucket, Cognito pool, API gateway, etc. — so the application
page in the AWS console auto-populates with the entire deployment.

### 5.3 — Why this matters

| Surface                                       | Without separate tag           | With separate tag                   |
| --------------------------------------------- | ------------------------------ | ----------------------------------- |
| Console search ("all my taskflow resources")  | Mixed pile across deployments  | Two clean per-deployment lists      |
| Cost Explorer breakdown                       | Combined billing               | Filterable per `awsApplication` tag |
| CloudWatch dashboards / alarms                | Need manual scoping            | Auto-scoped per app                 |
| IAM "deny on tag" policies                    | Awkward to express             | Trivial per-deployment gating       |
| Lifecycle automation (cleanup, audit reports) | Need stack-aware filters       | One query per deployment            |

## 6. Code changes

A single new file. **No edits** to existing CDK code.

**`backend/cdk/app_company_v2.py`**

```python
#!/usr/bin/env python3
import aws_cdk as cdk
from stack import TaskManagementStack

# Paste the ARN captured in step 5.1 before deploy. Pick the CORS origin
# strategy from §4a: Option A (current values) reuses the staging Vercel
# URL — Option B requires editing the three URL fields below.
#
# `integrations_enabled` (§4b): leave unset (default) for the initial V2
# deploy. To enable the integration platform later, change to True and
# re-deploy — the IntegrationsNestedStack provisions on first deploy and
# stays out of the CFN budget for the parent stack (it owns its own API
# Gateway). See INTEGRATION-PLATFORM-PLAN.md.
V2_CONFIG = {
    "cors_origins": [
        "https://taskflow-ns.vercel.app",
        "http://localhost:3000",
    ],
    "allowed_origin": "https://taskflow-ns.vercel.app",
    "app_url": "https://taskflow-ns.vercel.app",
    "api_stage": "prod",
    "gmail_secret_name": "taskflow-v2/gmail-credentials",
    "groq_secret_name": "taskflow-v2/groq-api-key",
    "table_name": "TaskFlowTable-v2",
    "user_pool_name": "TaskFlowUserPool-v2",
    "user_pool_client_name": "TaskFlowClient-v2",
    "uploads_bucket_name": "taskflow-ns-uploads-v2-prod",
    # "integrations_enabled": True,   # uncomment to ship the integration
    #                                   # platform with V2 (§4b Option II).
}

app = cdk.App()
stack = TaskManagementStack(
    app,
    "taskflow-v2",
    stage_config=V2_CONFIG,
    env=cdk.Environment(region="ap-south-1"),
)
cdk.Tags.of(stack).add(
    "awsApplication",
    "arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow-v2/05pduit0lnubyo3lv91e2n1l1f",
)
app.synth()
```

The existing `stack.py` already accepts a `stage_config` dict — no stack
code changes needed. Every name is config-driven.

## 7. Pre-deploy verification (5 checks)

Run before the first `cdk deploy`. Any failure means stop and rethink.

1. **S3 bucket name is globally available**
   ```bash
   aws s3api head-bucket \
     --bucket taskflow-ns-uploads-v2-prod \
     --profile company
   ```
   Must return `404 Not Found`. A `200` means the name is taken — pick a
   different `v2`.

2. **Stack name is free**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name taskflow-v2 \
     --profile company
   ```
   Must return `Stack with id taskflow-v2 does not exist`.

3. **DynamoDB table name is free**
   ```bash
   aws dynamodb describe-table \
     --table-name TaskFlowTable-v2 \
     --profile company
   ```
   Must return `ResourceNotFoundException`.

4. **CDK synth succeeds**
   ```bash
   cd backend/cdk
   cdk synth --app "python app_company_v2.py" --profile company
   ```
   Produces a CloudFormation template with no IAM ambiguity warnings. Grep
   the output for the *existing* application ARN to confirm we didn't
   paste it by mistake:
   ```bash
   cdk synth --app "python app_company_v2.py" --profile company \
     | grep -c "0eos9sfk62frvq2uhxwn7aw5z4"
   ```
   Expected: `0`.

5. **`cdk diff` against the existing stack — must be a no-op**
   ```bash
   cdk diff --app "python app_company.py" --profile company
   ```
   Must report **no changes** to the existing `taskflow` stack. Sanity
   check that the new file's existence didn't accidentally affect synth
   for the old app.

## 8. Deploy

```bash
cd backend/cdk

# One-time bootstrap — safe to re-run on an already-bootstrapped account
cdk bootstrap --profile company

# Deploy the new stack
cdk deploy \
  --app "python app_company_v2.py" \
  --profile company \
  --require-approval never
```

Expect ~3 minutes. The deploy creates a parent stack + nested stacks
(matching the existing architecture) with ~497 new CloudFormation
resources — well within account quotas.

## 9. Post-deploy verification

1. **Capture the stack outputs.** `cdk deploy` prints:
   - `ApiUrl`
   - `TableName`
   - `UserPoolId`
   - `UserPoolClientId`
   - `UploadsBucketName`
   - `CDNDomain`

   And, if `integrations_enabled=True` (§4b Option II) — additional
   outputs from the nested `IntegrationsNestedStack`:
   - `IntegrationsApiUrl` — set as `NEXT_PUBLIC_INTEGRATIONS_API_URL` in the V2 Vercel env (§10)
   - `IntegrationsOutboundQueueUrl` — already wired into existing Lambdas via env var; no manual action
   - `IntegrationsCredKmsKeyId` — informational (used by KMS console / IAM)

   Save them — the new frontend `.env.production.v2` needs all of
   them.

2. **Cognito + DDB isolation smoke test.**
   - Hit `POST <new-api-url>/signup` with throwaway credentials.
   - Confirm the new user appears in `TaskFlowTable-v2`.
   - Confirm **nothing changed** in the old `TaskFlowTable`. (`aws
     dynamodb scan --table-name TaskFlowTable --select COUNT --profile
     company` before and after — counts must match.)

3. **Resource group population.**
   - Open the new application page in the AWS console
     (`Systems Manager → Application Manager → taskflow-v2`).
   - Verify it lists the Lambda functions, the DDB table, the S3 bucket,
     the user pool, the API gateway. Empty list = the tag didn't apply;
     re-check the ARN in `app_company_v2.py`.

4. **CORS + auth round-trip.**
   - Point a Vercel preview at `<new-api-url>` and `<new-pool-id>`.
   - Sign up, log in, navigate to dashboard — verify no requests fall
     back to the old API by inspecting Network tab.

## 10. Frontend wire-up

Vercel project (separate from the existing prod project, can be a new
project or a preview branch with overridden env):

```
NEXT_PUBLIC_API_URL=<new ApiUrl from step 9.1>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<new UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<new UserPoolClientId>
NEXT_PUBLIC_AWS_REGION=ap-south-1

# Only when §4b Option II (integrations enabled). Falls back to
# NEXT_PUBLIC_API_URL when unset, so omitting it is safe.
NEXT_PUBLIC_INTEGRATIONS_API_URL=<new IntegrationsApiUrl from step 9.1>
```

Domain: `taskflow-v2.neurostack.in` (DNS — point a CNAME at the
Vercel project).

## 11. Rollback / cleanup

```bash
cdk destroy --app "python app_company_v2.py" --profile company
```

Because the new stack uses `RemovalPolicy.RETAIN` on the data layer
(table, bucket, user pool) — same protection the existing prod stack has
— `cdk destroy` removes the CFN resources but leaves the data orphaned.
For a full wipe, also delete by hand after `cdk destroy`:

```bash
aws dynamodb delete-table --table-name TaskFlowTable-v2 --profile company
aws cognito-idp delete-user-pool --user-pool-id <new-pool-id> --profile company
aws s3 rb s3://taskflow-ns-uploads-v2-prod --force --profile company
aws secretsmanager delete-secret --secret-id taskflow-v2/gmail-credentials --force-delete-without-recovery --profile company
aws secretsmanager delete-secret --secret-id taskflow-v2/groq-api-key   --force-delete-without-recovery --profile company
```

If integrations were enabled (§4b Option II) and you want to fully wipe
the integration KMS key (it's `RemovalPolicy.RETAIN` by design):

```bash
# The KMS key sits in PendingDeletion for 7–30 days; this schedules deletion.
aws kms schedule-key-deletion --key-id <IntegrationsCredKmsKeyId from outputs> \
  --pending-window-in-days 7 --profile company
```

The existing `taskflow` stack is **untouched** by any of this — different
stack name, different resource names, different ARN.

## 12. Risks & mitigations

| Risk                                            | Mitigation                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| S3 bucket name collision (globally unique)      | Step 7.1 verification                                                     |
| Operator confusion ("which prod is real?")      | Application name + ARN make the deployment self-labeling in the console   |
| Frontend cookie collision on shared parent      | Separate subdomain (`taskflow-v2.neurostack.in`) — distinct cookie scope |
| Lambda quota (default 1000/region)              | Combined ~64 functions; well under quota. Verify with `aws service-quotas get-service-quota --service-code lambda --quota-code L-B99A9384` |
| Idle cost while pilot has zero users            | Pay-per-request DynamoDB + ARM Lambda — idle cost ~$5–10/mo               |
| Pasted-wrong ARN (uses existing app's ARN)      | Step 7.4 grep guard catches this before deploy                            |
| Cognito email delivery routing collision        | Each pool has its own SES configuration; no routing overlap               |
| Same Groq API key across deployments            | Secrets are per-deployment — generate new key, store in new Secrets path  |
| CFN parent stack hits 500-resource cap when integrations are added later | Integration platform owns its OWN nested stack + dedicated API Gateway. Enabling `integrations_enabled` adds resources to the *nested* stack, not the parent. Verified on staging during platform build. |
| Existing prod (`taskflow`) integration data conflicts with V2 | Each deployment gets its own KMS key, SQS queues, and DDB SK namespace (`INTEGRATION#freshdesk#<id>`). Provider-namespaced — no cross-deploy bleed. |
| Webhook URL leak between staging and V2 | Each deployment's IntegrationsApi has a unique API GW ID (`abc123.execute-api...`). Bearer secrets are SHA-256 hashed per integration; even if a URL leaked, the bearer is per-integration scoped. |

## 13. What I need before executing

1. ~~**Application name**~~ — locked: `taskflow-v2`.
2. ~~**Subdomain**~~ — locked: `https://taskflow-ns.vercel.app`. *(But
   §4a still needs a decision: Option A = re-point staging Vercel at V2,
   Option B = stand up a separate Vercel deployment for V2. Option B is
   recommended.)*
3. ~~**ARN of the new AWS Application**~~ — locked:
   `arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow-v2/05pduit0lnubyo3lv91e2n1l1f`.
4. **§4b integration-platform decision** — Option I (defer, recommended), II (enable on day one), or III (enable on a planned ramp date). Default in `app_company_v2.py` is Option I.

§4a Option A vs B and §4b Option I/II/III are the remaining decisions.
Both only affect frontend wire-up + presence of the integrations nested
stack. Backend deploy is unblocked either way.

Next steps:

1. ✅ Write `backend/cdk/app_company_v2.py` with all values filled in.
2. Run the 5 pre-deploy checks (step 7).
3. Print `cdk diff` so you can confirm zero impact on the existing stack.
4. Stop. Deploy is yours to trigger.

---

## 14. Enabling the integration platform on V2 later (Option I → II)

If V2 launched with integrations deferred (§4b Option I) and you now want
to turn it on:

1. **Edit** `backend/cdk/app_company_v2.py` — uncomment `"integrations_enabled": True` in `V2_CONFIG`.
2. **Re-run pre-deploy checks** (§7) — the synth will now include the IntegrationsNestedStack. The `cdk diff` output should show only *additions* under the `Integrations` nested stack and the `IntegrationsApiUrl` / `IntegrationsOutboundQueueUrl` / `IntegrationsCredKmsKeyId` outputs.
3. **`cdk deploy --app "python app_company_v2.py" --profile company`** — runtime ~2–3 min. CFN provisions the new nested stack alongside the existing V2 resources without modifying anything else.
4. **Capture the three new outputs** (§9.1).
5. **Set `NEXT_PUBLIC_INTEGRATIONS_API_URL`** in the V2 Vercel project to the new `IntegrationsApiUrl`. Re-deploy frontend.
6. **Plan-gate is already enforced server-side** — Pro/Enterprise customers see the integrations UI in Settings; Free/Starter see an upgrade card.
7. **Smoke-test** with a free Freshdesk dev account: connect, paste the bearer + URL into Workflow Automator, create a ticket, confirm a TaskFlow task appears.

**Rollback** (turn it off again): re-comment the flag and `cdk deploy` —
CFN deletes the IntegrationsNestedStack. The KMS key has
`RemovalPolicy.RETAIN`, so the encrypted credential blobs stored in
DynamoDB remain decryptable after a future re-enable using the same key.
DynamoDB rows under `INTEGRATION#...` SKs survive the destroy; integration
records become unreachable until the stack is re-deployed.
