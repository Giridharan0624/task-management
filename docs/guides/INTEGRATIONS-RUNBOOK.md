# Integrations Platform — Runbook

Operational playbook for the 3rd-party integration platform. Pair with
[INTEGRATION-PLATFORM-PLAN.md](../planning/INTEGRATION-PLATFORM-PLAN.md)
(architecture) and [INTEGRATIONS-STAGING-DEPLOY.md](INTEGRATIONS-STAGING-DEPLOY.md)
(initial deploy steps).

This doc covers: adding a new connector, common failure modes, on-call
debugging, and credential / KMS rotation.

---

## 1. Adding a new connector

A connector is a Python module that satisfies the `Connector` Protocol
in [connector_protocol.py](../../backend/src/contexts/integrations/domain/connector_protocol.py).
Adding one touches three places — no platform code, no CDK, no frontend
unless you need a custom widget.

### 1.1 Worked example — Slack

See [SLACK-CONNECTOR-PLAN.md](../planning/SLACK-CONNECTOR-PLAN.md) for the
full design. Concretely:

1. **Create the package:**
   ```
   backend/src/contexts/integrations/connectors/slack/
   ├── __init__.py            # imports SlackConnector for registry side-effect
   ├── connect_form_schema.py # workspace name + bot token / OAuth redirect
   ├── slack_client.py        # httpx wrapper around api.slack.com
   ├── webhook_parser.py      # Events API payload → NormalizedEvent
   ├── field_map.py           # message ↔ NormalizedItem
   ├── echo_strategy.py       # message metadata sentinel
   └── connector.py           # SlackConnector(Connector) — the protocol class
   ```

2. **Register in [bootstrap.py](../../backend/src/contexts/integrations/bootstrap.py):**
   ```python
   from contexts.integrations.connectors.slack.connector import SlackConnector
   ...
   if not default_registry.has(SlackConnector.provider):
       default_registry.register(SlackConnector())
   ```

3. **(Optional) Add a UI-specific component** at
   `frontend/src/app/(dashboard)/settings/integrations/_components/SlackOAuthCallback.tsx`
   if Slack's OAuth flow needs custom handling beyond the schema-driven
   `DynamicConnectForm`. Most of the time this isn't needed.

### 1.2 What you do NOT touch

- `IntegrationsNestedStack` — no new Lambdas, queues, KMS keys.
- API Gateway routes — admin_router and webhook_router dispatch by path.
- DynamoDB schema — keys are namespaced by `provider`.
- `shared_kernel/integration_emitter.py` — already provider-agnostic.
- Existing task/project/comment handlers — already wired to emit.

If you find yourself wanting to change one of these, the abstraction is
wrong; raise it before merging the connector.

### 1.3 CI gates that block a bad connector

The [integrations-additivity.yml](../../.github/workflows/integrations-additivity.yml)
workflow runs on every PR and will fail if:

- Your connector module imports from another bounded context outside
  `contexts.integrations`.
- A platform module imports your connector by name (must go through registry).
- Your connector doesn't satisfy the `Connector` Protocol.
- Provider namespacing in DynamoDB SK keys regresses.

---

## 2. Common failure modes

### 2.1 `NEEDS_REAUTH` on an integration

**Symptom.** Admin sees a yellow badge on the integration detail page;
push attempts fail with `auth_failed`.

**Cause.** Provider rejected the stored credentials with 401. Common
triggers:

- The agent who generated the API key reset their password (Freshdesk
  rotates the API key on password reset).
- The agent was deactivated / removed from the provider workspace.
- OAuth refresh token expired (only relevant when we add OAuth).

**Recovery.** Admin re-runs the connect flow — same form, fresh API key.
The Integration record is updated in place; the existing `ExternalLink`
rows continue to work (they're keyed by external_id, not by credential).

**Defense in depth.** The pusher Lambda flips status to `NEEDS_REAUTH`
on a 401 from `push_item`; the sync_worker does the same on a 401 from
`fetch_item`. Both paths log an `IntegrationEvent` row for the audit
trail.

### 2.2 Plan downgrade — integration auto-paused

**Symptom.** A workspace downgrades from Pro to Free; their integrations
suddenly stop syncing.

**Behavior today.** Plan gate is enforced server-side at *connect* time
(`enforce_can_connect`) but not retroactively. An existing connection on
a downgraded plan keeps its DynamoDB row but Free has 0 calls/min on
Freshdesk's side, so syncs will fail with `http_429` and the audit log
shows repeated `rate_limited` events.

**Recovery.** Admin upgrades back to Pro, OR explicitly disconnects the
integration. There is no auto-pause flow in v1 — that's a v1.5 item.

**TODO marker.** When v1.5 lands, add a scheduled Lambda that scans
integration records, cross-references against the Plan, and flips status
to `PAUSED` with `last_error="Plan downgrade — integrations require Pro"`.

### 2.3 Webhook deliveries dropping silently

**Symptom.** Tickets created in Freshdesk don't produce TaskFlow tasks.
Smoke test (`scripts/integrations_smoke.sh`) passes — API is healthy.

**Triage order:**

1. **CloudWatch Logs → `WebhookRouterFn`.** Look for entries:
   - `401 invalid webhook secret` → admin pasted the wrong bearer.
     Disconnect, reconnect, re-paste in Workflow Automator.
   - `404 unknown integration` → the integration_id in the URL no
     longer exists. Webhook was configured with a stale URL after a
     disconnect; admin needs to reconfigure with a fresh one.
   - No log entries at all → Freshdesk isn't actually firing the
     webhook. Open the **Workflow Automator → Activity Log** in
     Freshdesk; check the rule fired and the response code Freshdesk
     received.

2. **DynamoDB.** Query for raw event audit rows:
   ```bash
   aws dynamodb query \
     --table-name TaskManagementTable-staging \
     --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
     --expression-attribute-values '{
       ":pk": {"S": "ORG#neurostack"},
       ":sk": {"S": "INTEGRATION#<integration_id>#EVENT#"}
     }' \
     --query "Items[].{ts:received_at.S,verified:bearer_verified.BOOL,enqueued:enqueued.BOOL,notes:notes.S}" \
     --output table
   ```
   Each inbound webhook gets a row here for 30 days. `verified=false`
   means bearer mismatch; `enqueued=false` means the SQS send failed.

3. **SQS Sync DLQ.** If events are reaching `SyncWorkerFn` but failing
   to upsert tasks, they land here after 5 retries:
   ```
   AWS console → SQS → integrations-sync-events-dlq
   ```
   Inspect the message bodies, fix the underlying issue, then either
   replay (move messages back to the main queue) or purge.

### 2.4 SQS DLQ filling up

**Symptom.** Consistent message accumulation in either DLQ
(`integrations-sync-events-dlq` or `integrations-outbound-jobs-dlq`).

**Triage:**

1. **Sample one message.** AWS console → SQS → DLQ → "View Messages →
   Poll messages" — read the body to learn which integration / external_id
   is poisoning the queue.

2. **Check CloudWatch Logs for the corresponding worker.** Look for
   stacktraces with the same `external_id` or `integration_id`. The
   sync_worker logs message IDs on every failure.

3. **Purge** when the cause is fixed:
   ```bash
   aws sqs purge-queue --queue-url <DLQ-URL>
   ```
   Or selectively replay by sending the messages back to the main queue
   with `aws sqs send-message`.

### 2.5 Echo loops

**Symptom.** A ticket bounces back and forth: TaskFlow update → Freshdesk
ticket update → TaskFlow webhook → another TaskFlow task update → ...
forever. Visible as duplicate updates in the audit log on both sides.

**Defense.** The Freshworks connector stamps every outbound write with a
custom-field sentinel (`cf_taskflow_sync_id`) and writes a 5-minute outbox
entry. The sync_worker checks the inbound payload's metadata against
recent outbox sync_ids and drops echoes. See
[connector.py](../../backend/src/contexts/integrations/connectors/freshworks/connector.py)
`detect_echo()`.

**If it's still happening:**

- The customer's Freshdesk plan may not allow custom fields. Check
  `IntegrationEvent` audit rows — if the inbound ticket payload doesn't
  carry `cf_taskflow_sync_id`, the customer is on a plan tier that strips
  custom fields. Time-window fallback (mentioned in the connector but
  not yet wired) is the next mitigation.
- The outbox TTL (5 min) may be too short if the provider has slow
  webhook delivery. Bump in `connectors/freshworks/connector.py` and
  `outbox_repo_dynamo.py` together.

### 2.6 KMS key rotation or deletion

**Symptom.** Sync worker / pusher logs show `KMS decrypt failed`. All
push and fetch attempts return errors; integration goes `NEEDS_REAUTH`.

**Cause.** The integration KMS CMK was deleted, disabled, or its policy
was edited to deny the integration Lambdas.

**Recovery.**

- If the key is **disabled**, re-enable it.
- If the key is **scheduled for deletion** (within the 7–30 day window),
  cancel deletion via console.
- If the key is **already deleted** or **rotated incompatibly**, ALL
  stored credential blobs are unrecoverable. Every integration must be
  reconnected manually by admins. The `ExternalLink` rows survive — the
  task ↔ ticket bindings are intact, only credentials are lost.

**Prevention.** The CMK has `RemovalPolicy.RETAIN` in CDK — `cdk destroy`
of the integration nested stack does NOT delete the key. Manual deletion
in the AWS console requires explicit confirmation + a 7–30 day waiting
period.

### 2.7 Leaked webhook secret

**Symptom.** Suspicion or evidence that the per-integration bearer
secret was committed to a public repo, posted in a Slack channel, etc.

**Recovery.** There is no rotate-secret flow yet (v1.5). The fastest
recovery is:

1. **Disconnect** the integration in TaskFlow → DynamoDB row deleted.
2. Re-run **connect** → fresh secret generated.
3. Update the Workflow Automator rule in the provider with the new
   bearer header.

The leaked secret becomes invalid the moment the integration record
is deleted, because the platform compares against the SHA-256 hash
stored on that specific row.

---

## 3. Routine ops

### 3.1 Scaling integration-Lambda concurrency

By default in staging, integration Lambdas have **no reserved concurrency**
(removed during the staging deploy because the personal AWS account
floor would have been violated). They share the account-wide pool.

To turn reservations back on for prod:

1. Raise the Lambda concurrency quota in the company AWS account
   (Service Quotas → AWS Lambda → Concurrent executions). Default is
   1000; request 2000+ to be safe.
2. Set `"_INTEGRATIONS_USE_RESERVED_CONCURRENCY": True` in the
   stage_config dict (or via stage env var) — see
   [integrations_stack.py](../../backend/cdk/nested/integrations_stack.py)
   for the gate.
3. Re-deploy. CDK will provision the reservations:
   - admin_router: 20
   - webhook_router: 50
   - sync_worker: 20
   - pusher: 20
   (Total 110 — needs ~120-slot headroom in the unreserved pool.)

### 3.2 Verifying additivity hasn't regressed

Before any merge into `main` or `saas-migration`, the
[integrations-additivity.yml](../../.github/workflows/integrations-additivity.yml)
GitHub Actions workflow runs on the PR. A red check there means the
additivity contract has been violated — fix before merging.

To run the same gates locally:

```bash
cd backend
pytest -x --tb=short \
  tests/integrations/test_no_inbound_imports.py \
  tests/integrations/test_emitter_swallows_all_errors.py \
  tests/integrations/test_connector_protocol_compliance.py \
  tests/integrations/test_provider_namespace_isolation.py
```

### 3.3 Smoke-testing a fresh deploy

```bash
export INTEGRATIONS_API_URL="<from CFN output IntegrationsApiUrl>"
export TASKFLOW_JWT="<paste auth_token from staging frontend after login>"
./scripts/integrations_smoke.sh
```

All four checks should pass before declaring the deploy healthy. See
[scripts/integrations_smoke.sh](../../scripts/integrations_smoke.sh).

---

## 4. Useful queries

### 4.1 Find every integration in an org

```bash
aws dynamodb query \
  --table-name TaskManagementTable-staging \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "ORG#<org_id>"},
    ":sk": {"S": "INTEGRATION#"}
  }' \
  --query "Items[?attribute_exists(integration_id)].{id:integration_id.S,provider:provider.S,status:status.S,connected_at:connected_at.S}" \
  --output table
```

(The `attribute_exists(integration_id)` filter excludes `EVENT#` and
`OUTBOX#` audit/sentinel rows.)

### 4.2 Trace a ticket → task linkage

```bash
# Forward (provider, external_id) → integration / TaskFlow item
aws dynamodb get-item \
  --table-name TaskManagementTable-staging \
  --key '{
    "PK": {"S": "ORG#<org>"},
    "SK": {"S": "EXTLINK#freshdesk#<external_id>"}
  }'

# Reverse (TaskFlow item) → all external links across providers
aws dynamodb query \
  --table-name TaskManagementTable-staging \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "ORG#<org>"},
    ":sk": {"S": "EXTLINK#ITEM#TASK#<task_id>#"}
  }'
```

### 4.3 Replay a poisoned DLQ message

After fixing the underlying bug:

```bash
aws sqs receive-message --queue-url <DLQ-URL> --max-number-of-messages 10 \
  | jq -c '.Messages[] | .Body' \
  | xargs -I {} aws sqs send-message \
      --queue-url <main-queue-URL> \
      --message-body {}
```

Then purge the DLQ once you've verified the replays succeed.

---

## 5. Pointers

- Plan: [INTEGRATION-PLATFORM-PLAN.md](../planning/INTEGRATION-PLATFORM-PLAN.md)
- Deploy checklist: [INTEGRATIONS-STAGING-DEPLOY.md](INTEGRATIONS-STAGING-DEPLOY.md)
- API reference: [API.md](../api/API.md) (`/integrations/*` section)
- Connector protocol: [connector_protocol.py](../../backend/src/contexts/integrations/domain/connector_protocol.py)
- Smoke test: [scripts/integrations_smoke.sh](../../scripts/integrations_smoke.sh)
- Additivity CI: [.github/workflows/integrations-additivity.yml](../../.github/workflows/integrations-additivity.yml)
