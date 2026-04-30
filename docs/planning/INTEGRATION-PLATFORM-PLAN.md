# Integration Platform — Implementation Plan (Freshworks is the first connector)

Status: **Proposed (not started)**
Owner: TBD
Target plans: **Pro / Enterprise** only (see [PLAN-LIMITS.md](../architecture/PLAN-LIMITS.md))
Direction: **TaskFlow consumes 3rd-party applications.** TaskFlow adapts to each provider's existing API/webhook surface. We do **not** ship any code, app, or UI into any 3rd-party product.
Scope of this plan: a **generic integration platform** inside TaskFlow plus the **first connector (Freshworks: Freshdesk + Freshservice)**. Future connectors (Slack, Jira, Google Calendar, GitHub, Zendesk, ClickUp, Linear, Salesforce, etc.) plug into the same platform — see section 17.
Additivity: **Purely additive feature.** TaskFlow MUST function 100% normally with the platform disabled, broken, slow, or never-connected. See section 1.5 for hard rules.

---

## 1. Goal

Build an **integration platform** inside TaskFlow that lets each org (tenant) connect its own external 3rd-party accounts (Freshdesk first, others later) and keep relevant items in sync with TaskFlow tasks. The platform is provider-agnostic; each provider plugs in as a **connector** that implements a shared contract.

**Platform responsibilities** (one-off, provider-agnostic):
- Connection lifecycle (connect, verify, list, pause, disconnect).
- Encrypted credential storage (KMS).
- Webhook URL routing — a single URL shape `/integrations/{provider}/webhook/{org_id}/{integration_id}` dispatches by provider.
- SQS queues for inbound reconciliation and outbound pushes (with DLQs and reserved Lambda concurrency).
- Plan gating, audit trail, error log, admin UI shell.
- ExternalLink registry mapping TaskFlow items ↔ external items per provider.

**Connector responsibilities** (per-provider):
- Auth method (API key, OAuth 2.0, basic, etc.) and connect-form schema.
- REST client with provider-specific rate-limit / pagination / error shape.
- Webhook signature verification (or shared-secret fallback).
- Field mapping between provider items and TaskFlow tasks.
- Loop guard mechanism (custom field, payload metadata, time window — whatever the provider supports).

**v1 connector — Freshworks (Freshdesk + Freshservice):**
- Freshdesk ticket created → TaskFlow task created in a linked project, assigned to the matching TaskFlow user by email.
- Freshdesk ticket updated (status, priority, assignee, due date) → linked TaskFlow task updated.
- TaskFlow task updated → corresponding Freshdesk ticket updated via REST.
- Loops prevented by a `cf_taskflow_sync_id` custom-field sentinel (Freshworks-specific).
- Freshchat / Freshsales / Freshcaller / Freshteam are deferred — same connector pattern when added.

---

## 1.2 Platform vs. connector — split summary

| Concern | Platform (shared) | Connector (per-provider) |
|---|---|---|
| Credential storage (KMS-encrypted) | ✅ | — |
| Connection lifecycle (connect / disconnect / pause) | ✅ | — |
| Webhook URL + bearer auth | ✅ | — |
| SQS queues + retries + DLQ + reserved concurrency | ✅ | — |
| Plan gating | ✅ | — |
| Admin UI shell (provider catalog, list, status, error log, disconnect) | ✅ | — |
| ExternalLink registry & echo-loop bookkeeping | ✅ | — |
| Outbound emitter from TaskFlow events | ✅ | — |
| Auth method (API key, OAuth 2.0, etc.) | — | ✅ |
| REST client + rate-limit shape | — | ✅ |
| Webhook signature verification | — | ✅ |
| Field mapping (`subject` vs `summary` vs `text`) | — | ✅ |
| Loop guard mechanism | — | ✅ |
| Connect-wizard form fields | — | ✅ (declarative schema; platform renders) |

---

## 1.5 Additivity contract (non-negotiable)

The integration is an **opt-in add-on**. With it disabled, broken, or never-connected, TaskFlow's existing surfaces — login, tasks, projects, comments, attendance, day-offs, timer, billing, RBAC, attachments, AI features — MUST behave exactly as they do today. The following are **hard rules** that every PR in this plan is reviewed against:

### Hard rules
1. **No existing code path imports from `contexts/integrations/`.** The integration context depends on others (it reads users/tasks/projects); nothing else may depend on it. CI will fail any PR that reverses this direction.
2. **No existing handler is modified to add integration logic inline.** All integration side effects fire through an event bus (see rule 3) or via SQS, never via direct function calls inside `task` / `project` / `comment` use cases.
3. **Outbound sync is decoupled via SQS, not in-line.** When a TaskFlow task changes, the existing `task` use case continues to do exactly what it does today. A new lightweight emitter (also in `shared_kernel/`, not in `task`) reads a feature flag and, only if enabled, drops a job onto the integrations outbound queue. If the queue, the Lambda, or the integration is broken, the task write still succeeds.
4. **No new required env vars on existing Lambdas.** All integration-specific env vars (`FRESHWORKS_CRED_KMS_KEY_ID`, `FRESHWORKS_SYNC_QUEUE_URL`, `FRESHWORKS_OUTBOUND_QUEUE_URL`) are set only on the new integration Lambdas. The existing 32 Lambdas are not redeployed.
5. **No new required IAM permissions on existing Lambdas.** Only the new integration Lambdas get KMS-decrypt and SQS-send. Existing roles are untouched.
6. **No schema migrations on existing items.** All new SK patterns (`INTEGRATION#...`, `EXTLINK#...`) are net-new rows. We do not add columns, GSIs, or attributes to existing user/task/project items.
7. **No DynamoDB GSI changes.** Existing GSI1/GSI2 keep their current shape. If a lookup is needed (e.g. task → external_link), we add a dedicated reverse SK row, not a new GSI.
8. **Feature flag at three layers** — backend use case, frontend UI, and CDK stack. Default OFF. Flag name: `freshworks_integration_enabled` (per-org). Even with the code deployed, no behavior changes until an admin explicitly connects an integration.
9. **Plan gate is enforced server-side.** Free/Starter customers can never connect. Plan downgrade auto-pauses (does not delete) the integration.
10. **All integration Lambdas have their own concurrency limit (reserved concurrency).** A flood of webhooks cannot starve the main API Lambdas of concurrency.
11. **All integration failures are silent to existing flows.** A 5xx from the integration sync worker, a poisoned SQS message, an expired KMS key, or a DDB throttle MUST NOT bubble back into the user-facing task write path. Logged, alarmed, dropped — never propagated.
12. **Disable path is one click and instantaneous.** Admin clicks "Disconnect" → integration row marked `disabled` → the next webhook returns 410 Gone, the next outbound job no-ops. No data loss for existing TaskFlow tasks.
13. **Uninstall path is reversible.** Removing the integration deletes the credential row and pauses sync; it does not delete the linked TaskFlow tasks (those become regular standalone tasks). `ExternalLink` rows are kept for audit unless admin explicitly purges.

### What this means architecturally
- The new context lives **alongside** the existing 12 contexts; it does not replace or modify any of them.
- The CDK stack adds a separate construct (`IntegrationsConstruct`) that can be commented out with zero impact on the rest of the stack.
- The frontend adds a new route group (`settings/integrations/`); no existing page imports from it.
- The pusher reads from a new SQS queue. The existing task write path emits an event via a `try/except` wrapper that swallows all errors. The integration is downstream of, never in front of, the user.

### Tested by
- A dedicated CI check that fails if any file under `contexts/{user,task,project,comment,attendance,dayoff,taskupdate,activity,upload,org,system}/` imports anything from `contexts/integrations/`.
- A regression-suite run with the integration stack literally not deployed (CDK skip flag) — every existing test must still pass.
- A staging soak test where we disable the integration mid-flight and confirm zero impact on running task operations.

---

## 2. Scope

### In scope
- Per-org connection record (subdomain + API key, KMS-encrypted).
- One global webhook URL with org_id in the path. The customer's admin pastes this URL into their own Freshdesk Workflow Automator — we do **not** push any rule/app/code into Freshworks.
- Inbound: ticket → task create/update (driven by Workflow Automator webhooks the admin configures).
- Outbound: task update → ticket update via Freshdesk/Freshservice REST API.
- Email-based assignee mapping with three modes (`strict` / `fallback` / `auto_invite`).
- Plan gate (Pro+).
- Admin UI inside TaskFlow: connect wizard, status, error log, disconnect.

### Not in scope
- Any code, UI, app, or marketplace listing deployed into Freshworks (no FDK app, no Crayons sidebar, no serverless app, no marketplace review).
- OAuth flow — the FDK platform is required for OAuth on Freshdesk/Freshservice; without an FDK app we use API key + subdomain only.
- Historical-ticket backfill.
- Freshservice projects/tasks deep mapping (uses ticket model only in v1).
- Freshchat / Freshsales / Freshcaller / Freshteam (Freshdesk + Freshservice only in v1; abstraction supports adding them later).
- Group / team mapping.
- Round-robin assignment on unassigned inbound tickets.
- SLA-aware filtering.
- Comment / conversation sync (schema is set up for it; deferred).
- Attachment sync.

### Explicit non-goals
- We do **not** auto-create TaskFlow users on first sight of an unknown agent email (consumes seats without consent).
- We do **not** treat the webhook payload as the source of truth — every event is reconciled against the REST API.

---

## 3. Architecture overview

Diagram below shows the **Freshworks connector** as a concrete example. The same flow applies to every connector — only the box on the left and the connector module change.

```
Freshdesk (acme.freshdesk.com)                TaskFlow (org_id="acme")
─────────────────────────────                 ─────────────────────────
[1] Admin connects in TaskFlow ──── verify ──► platform → freshworks.verify_credentials()
                                                │      (which calls GET /agents/me)
                                                ▼
                                        Save connection record
                                        (KMS-encrypted API key, provider="freshdesk")
                                                │
[2] Admin pastes webhook URL into       Provide URL + bearer secret
    Workflow Automator rule              /integrations/freshdesk/webhook/{org}/{id}
                                                │
[3] Ticket event (created/updated) ─── POST ───► API GW → webhook_dispatch Lambda
                                                │   resolve provider from URL → freshworks
                                                │   verify bearer
                                                │   connector.parse_webhook() → NormalizedEvent
                                                │   write raw event (audit, 30d TTL)
                                                │   enqueue SQS sync job
                                                │   return 200 fast
                                                │
[4] Sync worker (SQS) ◄── GET /tickets/{id} ────│
                                                │   reconcile against REST
                                                │   upsert task in DDB
                                                │   resolve assignee by email
                                                │
[5] User updates task in TaskFlow                │   task write succeeds normally
                                                │   shared_kernel emitter (try/except,
                                                │     reads per-org flag) drops SQS job.
                                                │   If emitter fails → task still saved.
                                                │
[6] Pusher Lambda ── PUT /tickets/{id} ─────────│   stamp cf_taskflow_sync_id
                                                │   record sentinel (5-min TTL)
                                                │
[7] Freshdesk re-fires webhook                  webhook_handler sees sentinel
                                                │   matches RecentOutbound → DROP
                                                │   loop killed
```

---

## 4. New bounded context — `integrations` (platform + connectors)

Add `backend/src/contexts/integrations/` following the standard four-layer split. **Platform code is provider-agnostic; provider-specific code lives under `connectors/{provider}/`.**

```
integrations/
├── domain/                            # PLATFORM — provider-agnostic
│   ├── integration.py                 # Integration entity, status enum, plan-aware
│   ├── external_link.py               # ExternalLink (task ↔ external_id, namespaced by provider)
│   ├── normalized_event.py            # Provider-agnostic event shape produced by connectors
│   ├── normalized_item.py             # Provider-agnostic item shape (title/desc/status/...)
│   ├── credentials.py                 # Sealed credential value object (KMS-bound)
│   ├── connector_protocol.py          # Connector Protocol (see section 4.5)
│   ├── connector_registry.py          # provider_name → Connector instance
│   ├── sync_event.py                  # raw inbound audit row
│   └── repositories.py                # interfaces only
├── application/                       # PLATFORM
│   ├── connect_integration.py         # use case: dispatch verify_credentials() to connector
│   ├── disconnect_integration.py
│   ├── handle_webhook_event.py        # idempotent inbound; calls connector.parse_webhook + fetch_item
│   ├── push_item_update.py            # outbound; calls connector.push_item
│   ├── resolve_assignee.py            # email → TaskFlow user id (provider-agnostic, 3 modes)
│   └── echo_guard.py                  # platform-side outbox; calls connector.detect_echo
├── infrastructure/                    # PLATFORM
│   ├── integration_repo_dynamo.py
│   ├── external_link_repo_dynamo.py
│   ├── sync_event_repo_dynamo.py
│   ├── outbox_repo_dynamo.py
│   └── kms_credentials.py             # encrypt/decrypt via KMS data key
├── connectors/                        # PER-PROVIDER plug-ins
│   └── freshworks/
│       ├── connector.py               # implements Connector protocol
│       ├── freshdesk_client.py        # httpx, rate-limit aware, Retry-After backoff
│       ├── freshservice_client.py     # same surface, different base URL
│       ├── webhook_parser.py          # Workflow Automator payload → NormalizedEvent
│       ├── field_map.py               # ticket fields ↔ NormalizedItem
│       ├── echo_strategy.py           # cf_taskflow_sync_id custom-field sentinel
│       └── connect_form_schema.py     # declarative form: subdomain + api_key
└── handlers/                          # PLATFORM (one Lambda per route, dispatches by provider)
    ├── connect_integration.py         # POST /integrations/{provider}
    ├── list_integrations.py           # GET  /integrations
    ├── get_integration.py             # GET  /integrations/{id}
    ├── delete_integration.py          # DELETE /integrations/{id}
    ├── list_providers.py              # GET  /integrations/providers (catalog for the UI)
    ├── webhook_dispatch.py            # POST /integrations/{provider}/webhook/{org_id}/{integration_id}
    ├── sync_worker.py                 # SQS-triggered, dispatches by provider
    └── pusher.py                      # SQS-triggered, dispatches by provider
```

All handlers follow the existing pattern from [shared_kernel/auth_context.py](../../backend/src/shared_kernel/auth_context.py): `auth = extract_auth_context(event)` first, then operate on `org_id` via the ContextVar.

The webhook handler is **unauthenticated by Cognito** — it authenticates via the per-integration bearer secret stored at connect time. It still stamps `org_id` into the ContextVar so downstream repositories tenant-scope correctly.

### Outbound emitter — kept out of the existing task context

To honor the additivity contract, the outbound side does **not** add a call inside `contexts/task/application/`. Instead, a tiny **provider-agnostic** module lives in `shared_kernel/integration_emitter.py`:

```python
# shared_kernel/integration_emitter.py
def emit_item_changed(org_id: str, item_type: str, item_id: str, change_type: str) -> None:
    """Best-effort, never raises. Existing handlers are unaffected if this fails."""
    try:
        if not _any_integration_enabled(org_id):  # cheap flag check
            return
        sqs.send_message(QueueUrl=OUTBOUND_QUEUE_URL, MessageBody=json.dumps({
            "org_id": org_id, "item_type": item_type, "item_id": item_id,
            "change_type": change_type,
        }))
    except Exception:
        log.warning("integration emit failed; ignoring", exc_info=True)
```

The pusher Lambda receives the message, looks up which integrations care about this `(org_id, item_type)` from the registry, and dispatches to each connector's `push_item`. **Existing handlers do not know about Freshworks, Slack, or any other provider** — they just emit a generic event.

Existing task/project/comment handlers add **one line** at the end of a successful write:
```python
emit_item_changed(auth.org_id, "task", task.id, "updated")
```
The emitter swallows all exceptions, checks a per-org flag, and only enqueues if at least one integration is connected. The only modification to existing handlers is this one trailing call — reviewed for safety and gated by CI to ensure it cannot raise.

---

## 4.5 Connector protocol

Every provider implements this protocol. Adding Slack/Jira/etc. means writing a new module under `connectors/{provider}/` that satisfies the contract — no platform code changes.

```python
# contexts/integrations/domain/connector_protocol.py
from typing import Protocol, runtime_checkable

class AuthMethod(StrEnum):
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    BASIC  = "basic"
    WEBHOOK_ONLY = "webhook_only"   # e.g. inbound-only providers

class Capability(StrEnum):
    READ_ITEMS       = "read_items"
    WRITE_ITEMS      = "write_items"
    RECEIVE_WEBHOOKS = "receive_webhooks"
    OAUTH_CALLBACK   = "oauth_callback"

@runtime_checkable
class Connector(Protocol):
    provider: str                          # "freshdesk", "freshservice", "slack", "jira", ...
    display_name: str                      # "Freshdesk"
    auth_method: AuthMethod
    capabilities: set[Capability]
    connect_form_schema: dict              # declarative form for the UI

    def verify_credentials(self, creds: Credentials) -> AccountInfo: ...
    def parse_webhook(self, headers: dict, body: bytes) -> NormalizedEvent | None: ...
    def fetch_item(self, creds: Credentials, external_id: str) -> NormalizedItem: ...
    def push_item(self, creds: Credentials, link: ExternalLink, patch: ItemPatch) -> PushResult: ...
    def detect_echo(self, item: NormalizedItem, outbox_ids: set[str]) -> bool: ...
    def stamp_outbound(self, patch: ItemPatch, sync_id: str) -> ItemPatch: ...   # adds sentinel
```

**Registry pattern** — `connector_registry.py` builds a `dict[str, Connector]` at module load. The platform never imports a connector by name; it always goes through the registry:

```python
connector = registry.get(integration.provider)
event = connector.parse_webhook(headers, body)
```

This is the single seam between platform and connectors. CI gates ensure no platform module imports anything under `connectors/` except via the registry.

### Provider catalog (UI-facing)

`GET /integrations/providers` returns the registry's contents as JSON, so the frontend's connect-wizard renders a marketplace-style catalog driven entirely by what's installed. Adding a connector means it shows up in the UI automatically — no frontend code change needed unless the connector's connect form needs custom widgets.

---

## 5. DynamoDB schema additions

All keys built through [tenant_keys.py](../../backend/src/shared_kernel/tenant_keys.py). New SK patterns — **all provider-namespaced** so the same schema serves every connector:

| PK | SK | Purpose | TTL |
|---|---|---|---|
| `ORG#{org}` | `INTEGRATION#{provider}#{id}` | Connection record (provider-specific creds blob, status, webhook secret hash) | none |
| `ORG#{org}` | `INTEGRATION#{id}#EVENT#{ts}#{uuid}` | Raw inbound webhook payloads (audit) | 30 days |
| `ORG#{org}` | `INTEGRATION#{id}#OUTBOX#{sync_id}` | In-flight echo-guard sentinels (5 min TTL) | 5 minutes |
| `ORG#{org}` | `EXTLINK#{provider}#{external_id}` | TaskFlow item ↔ external item binding | none |
| `ORG#{org}` | `EXTLINK#ITEM#{item_type}#{item_id}` | Reverse lookup (item_id → external_ids across providers) | none |

`{provider}` is the connector's `provider` string (`freshdesk`, `freshservice`, `slack`, `jira`, ...). The reverse lookup intentionally does **not** include provider — one TaskFlow task can be linked to a Freshdesk ticket *and* a Slack thread simultaneously.

**Constraints**
- No aggregate `LIST` keys (per repo conventions in [CLAUDE.md](../../CLAUDE.md)).
- Credentials are encrypted with a KMS data key before storage; decryption only happens inside the connector that needs to call out.
- `webhook_secret` is stored as a SHA-256 hash — only the bearer presented at request time is compared.
- The credential blob is **opaque to the platform** — it's a JSON string the connector encrypts/decrypts using its own schema (API key for Freshworks, OAuth tokens for Slack, etc.).

---

## 6. Field mapping

The platform speaks in `NormalizedItem`. Each connector's `field_map.py` translates between the provider's native shape and `NormalizedItem`. Adding a connector means writing one mapping module — no platform changes.

`NormalizedItem` shape (provider-agnostic):
- `title`, `description`, `status`, `priority`, `assignee_email`, `due_at`, `tags[]`, `external_id`, `external_url`, `metadata{}` (provider-specific extras).

Freshworks connector mapping:

| Freshdesk | NormalizedItem → TaskFlow | Notes |
|---|---|---|
| `subject` | `title` → `task.title` | |
| `description_text` | `description` → `task.description` | strip HTML if present |
| `status` (2/3/4/5) | `status` → `task.status` | open / in_progress / resolved / closed |
| `priority` (1/2/3/4) | `priority` → `task.priority` | low / medium / high / urgent |
| `responder_id` → agent email | `assignee_email` → `task.assignee_id` | resolved via `/agents/{id}` then `GSI1PK=USER_EMAIL#{email}` |
| `due_by` | `due_at` → `task.due_at` | ISO 8601 UTC |
| `tags[]` | `tags[]` | |
| `cf_taskflow_sync_id` | (sentinel only) | echo guard, dropped after match |

The reverse direction reuses the same map (one source of truth).

---

## 7. Assignee resolution

Lives in `application/resolve_assignee.py`. Algorithm:

```
input: agent_email, org_id, mode

1. user = user_repo.find_by_email(org_id, agent_email)
2. if user: return user.id
3. switch mode:
     strict       → return None; log integration_event(reason="user_not_in_taskflow")
     fallback     → return integration.fallback_assignee_id
     auto_invite  → if plan == enterprise:
                        send invite, return None (assigned later when accepted)
                    else:
                        return None; log "auto_invite_blocked_by_plan"
```

Edge cases handled explicitly:
- `responder_id` is null in Freshdesk → return None (unassigned).
- Email collision impossible within a tenant (`USER_EMAIL` is globally unique per [tenant_keys.py](../../backend/src/shared_kernel/tenant_keys.py)).
- Agent deactivated in Freshdesk → next webhook reassigns to None.
- Reverse direction (TaskFlow → Freshdesk): `GET /agents?email={email}` to find `responder_id`. If no match, log warning and leave ticket assignment untouched (do **not** null it out).

Mode default: **`strict`**. Matches how Jira ↔ Freshdesk integrations behave and avoids surprising seat consumption.

---

## 8. Loop prevention

1. Every outbound `PUT /tickets/{id}` from `pusher.py` includes `cf_taskflow_sync_id = uuid4()`.
2. The same `sync_id` is written to `OUTBOX#{sync_id}` with TTL 5 min.
3. Every inbound webhook in `handle_webhook_event.py`:
   - reads `cf_taskflow_sync_id` from the reconciled ticket payload.
   - if it matches an `OUTBOX` row → drop event.
   - else → process normally.
4. Fallback if customer plan blocks custom fields (Freshdesk Free tier): compare `ticket.updated_at < ExternalLink.last_pushed_at + 30s` and drop. Brittle but works.

---

## 9. CDK changes ([backend/cdk/stack.py](../../backend/cdk/stack.py))

| Resource | Count | Notes |
|---|---|---|
| Lambdas | 4 | admin_router, webhook_router, sync_worker, pusher — **single router per traffic class**, dispatches by method+path inside Python. All with reserved concurrency. |
| **API Gateway** | **1 dedicated REST API** | **The integration platform owns its own RestApi** (separate hostname) so the parent stack's RestApi never grows. The parent CFN stack was at the 500-resource cap; nesting integrations under it pushed it over. Adding new connectors with new routes now never touches the parent budget. Frontend uses the dedicated host via `NEXT_PUBLIC_INTEGRATIONS_API_URL` (CFN output `IntegrationsApiUrl`). Auth = same Cognito JWT (authorizer in the nested stack binds to the parent user pool). |
| API Gateway routes | 4 | 2 authed methods on `/integrations` and `/integrations/{proxy+}`; 1 unauthed `ANY` method on `/integration-webhooks/{proxy+}`. All entirely inside the nested stack. |
| SQS queues | 2 | `integrations-sync-events` + DLQ; `integrations-outbound-jobs` + DLQ. **Shared across all providers** — message body carries the provider name. |
| KMS key | 1 | dedicated CMK for integration credentials. Used by every connector via the shared `kms_credentials.py`. |
| IAM grants | — | KMS decrypt to **integration Lambdas only**; SQS send to existing Lambdas via the emitter (the only IAM addition to existing roles, scoped to one queue ARN); DDB rw on tenant table for new SK patterns only |
| Env vars | per stage | `INTEGRATIONS_CRED_KMS_KEY_ID` and `INTEGRATIONS_SYNC_QUEUE_URL` set only on integration Lambdas; `INTEGRATIONS_OUTBOUND_QUEUE_URL` set on existing Lambdas (consumed only by the emitter, which no-ops if missing). Names are provider-agnostic. |

All integration resources live in a separate **`IntegrationsNestedStack`** that can be omitted (gated by `integrations_enabled` stage flag) with zero impact on the rest of the stack. **Adding a new connector = zero CDK changes** — connectors are pure Python modules registered at import time. The construct is conditionally instantiated based on a stage flag; staging deploys it, prod stays gated until 1e/GA per CLAUDE.md's "no prod-touching action until user explicitly says cut over to prod" memory.

**Operational note for admins:** the integrations API is a separate hostname from the main TaskFlow API. Two domains in browser DevTools is the cost; the win is that the parent stack stays clean and the integration platform is fully isolated for IAM/audit purposes.

Per CLAUDE.md deployment convention: staging-only knobs go in `app_staging.py`, prod stays in `app.py` / `app_company.py`.

---

## 10. Frontend changes ([frontend/src/](../../frontend/src/))

The frontend is **provider-agnostic**. The connect wizard reads the provider catalog from the platform (`GET /integrations/providers`) and renders forms from the connector's declarative `connect_form_schema`. Adding a connector usually means **zero frontend code change** — only when a connector needs custom widgets (e.g. an OAuth redirect button) does a small per-provider component get added.

New files:

```
app/(dashboard)/settings/integrations/
├── page.tsx                       # list of connected integrations across all providers
├── browse/page.tsx                # marketplace-style catalog (driven by /integrations/providers)
├── connect/[provider]/page.tsx    # generic connect wizard, schema-driven
├── [id]/page.tsx                  # detail: status, last sync, error log, disconnect
└── _components/
    ├── ProviderCatalog.tsx        # tile grid of available connectors
    ├── DynamicConnectForm.tsx     # renders connect_form_schema → fields
    ├── IntegrationStatusBadge.tsx
    ├── AssigneeModeSelect.tsx
    ├── ProviderSetupSteps.tsx     # provider-specific markdown rendered from connector metadata
    └── IntegrationEventLog.tsx

app/(dashboard)/settings/integrations/_providers/
└── freshdesk/                     # OPTIONAL: custom widgets if the provider needs them
    └── WebhookSetupGuide.tsx      # rich Workflow Automator screenshots specific to Freshdesk

lib/api/integrations.ts            # fetch wrapper for /integrations endpoints
lib/hooks/useIntegrations.ts       # React Query hooks (per-provider hooks NOT needed; one hook serves all)
```

Plan gate: render the connect button only when `usePlan().tier ∈ {pro, enterprise}`; otherwise show an upgrade card.

---

## 11. Plan gating ([docs/architecture/PLAN-LIMITS.md](../architecture/PLAN-LIMITS.md))

Limits apply across **all connectors combined** (a Pro org gets a total of 3 active integrations regardless of provider).

| Plan | Total integrations | Notes |
|---|---|---|
| Free / Starter | 0 | Connect button hidden, Browse catalog still visible (read-only) |
| Pro | 3 | Strict / fallback assignee modes |
| Enterprise | unlimited | All three modes incl. `auto_invite` |

Enforced in `connect_integration.py` use case **and** at the UI gate. Some connectors may carry their own additional plan rules (e.g. a future Salesforce connector might be Enterprise-only); these are declared in the connector's metadata and enforced by the platform.

---

## 12. Failure modes

| Failure | Detection | Behavior |
|---|---|---|
| Out-of-order webhooks | reconciled `updated_at` older than stored | skip update, keep `last_pulled_at` advanced |
| Echo loop | sentinel match | drop event |
| Rate limit (429) | `Retry-After` header | exponential backoff in SQS, max 5 retries → DLQ |
| Stale credentials (401) | response status | mark integration `needs_reauth`, notify admins |
| Plan-locked field (403) | response body / status | log "plan-locked feature" hint in admin UI |
| Customer downgrades to Free (0 calls/min) | repeated 429 | auto-pause integration, surface banner |
| Bearer secret mismatch | webhook handler | return 401, log + alert |
| Subdomain header mismatch | webhook handler | return 403, suspected spoof |
| Custom field unavailable | initial verify | switch loop guard to time-based fallback |
| `responder_id` not in TaskFlow | use case | apply `assignee_mode` policy |
| Integration Lambda completely down | API GW receives webhook | webhook returns 200 immediately after writing to SQS; if SQS itself is down, return 503 — Freshdesk Workflow Automator retries; no impact on TaskFlow's main API |
| Outbound emitter throws | task/project handler | swallowed by `try/except`; task write succeeds; warning logged |
| Emitter SQS quota exhausted | existing Lambda | swallowed; alarm fires; existing flow unaffected |
| KMS key rotated/revoked | sync worker / pusher | integration marked `needs_reauth`; **no impact on any non-integration code** because no other Lambda has KMS-decrypt on this key |
| Customer never connects | — | no rows written, no Lambdas invoked, zero cost — feature is dormant |

---

## 13. Test plan

Add per-context tests under `backend/tests/integrations/` (this is the first context with its own subdir; we accept the small departure from the current flat layout because surface area is large).

| Test | What it covers |
|---|---|
| `test_connect_validates_credentials.py` | Bad API key → 401 surfaces as friendly error |
| `test_webhook_bearer_auth.py` | Wrong bearer → 401 |
| `test_webhook_subdomain_match.py` | Spoofed subdomain → 403 |
| `test_handle_webhook_idempotent.py` | Same `(external_id, updated_at)` twice → one upsert |
| `test_resolve_assignee_strict.py` | Email not in org → unassigned + event logged |
| `test_resolve_assignee_fallback.py` | Email not in org → fallback user assigned |
| `test_loop_prevention_sentinel.py` | Outbound sync_id round-trip → inbound dropped |
| `test_pusher_handles_429.py` | `Retry-After` respected |
| `test_pusher_handles_401.py` | Marks integration `needs_reauth` |
| `test_field_map_freshdesk_to_task.py` | Status/priority enums map correctly |
| `test_multitenancy_isolation.py` | Tenant A's webhook cannot mutate tenant B's tasks |
| `test_emitter_swallows_all_errors.py` | Emitter raises for every failure mode (KMS down, SQS down, DDB throttle, flag service down) → existing task write still succeeds |
| `test_no_inbound_imports_from_integrations.py` | Static check: no file under existing 12 contexts imports from `contexts/integrations/` (CI gate) |
| `test_existing_suite_passes_without_integration_stack.py` | Run full backend test suite with `INTEGRATIONS_DISABLED=1`; every existing test passes |
| `test_connector_protocol_compliance.py` | Every registered connector satisfies the `Connector` Protocol — surfaces missing methods at import time |
| `test_no_platform_imports_from_connectors.py` | Static check: no platform module imports anything under `connectors/{provider}/` except via the registry |
| `test_provider_namespace_isolation.py` | A `freshdesk` connection in tenant A cannot read or affect an `EXTLINK#slack#...` row in the same tenant |

Multi-tenancy isolation test gates merge — same convention as the existing CI gate ([backend/tests/test_multitenancy.py](../../backend/tests/test_multitenancy.py)).

---

## 14. Phased rollout

Phases now split between **platform** (one-time investment, used by every future connector) and **first connector** (Freshworks). Nothing is deployed into any 3rd-party product.

| Phase | Scope | Gate |
|---|---|---|
| **0 — design** | This doc reviewed and signed off | — |
| **1P — platform skeleton** | `Connector` protocol, registry, `NormalizedItem`/`Event`, KMS-encrypted credential blob, ExternalLink, outbox, audit-event row, plan gate, additivity-CI checks. Generic admin endpoints (`/integrations`, `/integrations/{id}`, `/integrations/providers`). Generic webhook dispatcher. **No connectors registered yet — the API returns an empty catalog.** | Deployed to staging behind `INTEGRATIONS_ENABLED=true` |
| **1a — Freshworks connector skeleton** | `connectors/freshworks/` registers; connect form schema for subdomain + API key; `verify_credentials` calls Freshdesk `/agents/me`; KMS round-trip exercised; **no sync yet** | Org admin can connect/disconnect on staging |
| **1b — Freshworks inbound** | `webhook_parser.py`, `field_map.py`, assignee resolution (3 modes), sync worker reconciles via REST | Verified on staging with a real Freshdesk dev account |
| **1c — Freshworks outbound** | `push_item`, `cf_taskflow_sync_id` echo strategy, 429/401 retry, outbound emitter wired into existing task handlers | Round-trip verified on staging |
| **1d — UI** | Provider catalog, dynamic connect wizard, status page, error log, disconnect, Freshdesk-specific webhook setup guide | Internal dogfooding |
| **1e — beta → GA** | Behind `freshworks_integration_beta` flag → one paying Pro customer → flag removed → Pro+ GA, documented in [docs/api/API.md](../api/API.md) | Customer-validated |

Future connectors slot in as **1a-style phases** only — phase 1P is paid for once. Indicative cost for a second connector (e.g. Jira): 3–5 days for a focused engineer (auth + REST client + webhook parser + field map + connect form + tests). No new infra, no new Lambdas, no new SQS, no new admin UI.

Per CLAUDE.md rule: nothing ships to prod until the full change is verified end-to-end on staging.

---

## 15. Open questions

1. **Project linking model** — does the integration record bind to **one** TaskFlow project, or do we route by Freshdesk group → project? v1: one project per integration. Add multi-project routing in v1.5 if customers ask.
2. **Comment / conversation sync** — out of scope for v1, but the schema (`EXTLINK`) is set up for it. Add a `freshdesk_conversations` SK pattern when we tackle it.
3. **Attachment sync** — not in v1. Will need S3 cross-write and is a meaningful storage cost.
4. **Time entries** — Freshdesk has them; TaskFlow has timer entries. Mapping is plausible but plan-locked on Freshdesk side. Defer.
5. **Auto-invite default** — should `auto_invite` ever be the default on Enterprise? Recommend **no** — keep `strict` as default everywhere; admin opts in explicitly.

---

## 16. References

- [Freshdesk API](https://developers.freshdesk.com/api/) — REST endpoints we call from TaskFlow
- [Freshservice API v2](https://api.freshservice.com/v2/) — REST endpoints we call from TaskFlow
- [Freshdesk rate limits](https://support.freshdesk.com/support/solutions/articles/225439-what-are-the-rate-limits-for-the-api-calls-to-freshdesk-) — drives our pusher backoff strategy
- [Freshservice Workflow Automator webhooks](https://support.freshservice.com/support/solutions/articles/157143-using-webhooks-with-the-workflow-automator) — what the customer's admin configures inside their own Freshdesk
- Internal: [tenant_keys.py](../../backend/src/shared_kernel/tenant_keys.py), [auth_context.py](../../backend/src/shared_kernel/auth_context.py), [PLAN-LIMITS.md](../architecture/PLAN-LIMITS.md), [RBAC-DOCUMENTATION.md](../architecture/RBAC-DOCUMENTATION.md)

---

## 17. Future connectors (tracker)

These are the providers we expect to add next. The Connector protocol must accommodate all of them; if a row below would force a redesign, raise it during section 0 review.

| Provider | Auth | Inbound | Outbound | Loop guard | Notes / surface |
|---|---|---|---|---|---|
| **Freshworks (Freshdesk + Freshservice)** ✅ v1 | API key + subdomain | Workflow Automator webhook | REST PUT | Custom field `cf_taskflow_sync_id` | This plan |
| **Slack** | OAuth 2.0 (Slack app) | Events API (HMAC-signed) | Web API (`chat.update`, `chat.postMessage`) | Message metadata | Item type: thread / channel message; multi-account via Slack workspace |
| **Jira (Cloud)** | OAuth 2.0 (3LO) | Webhooks (HMAC) | REST v3 (`/rest/api/3/issue`) | Issue property `taskflow_sync_id` | Field map heavier; status workflows are per-project |
| **GitHub** | OAuth 2.0 / App | Webhooks (HMAC SHA256) | REST / GraphQL | Issue body marker `<!--tf:{id}-->` | Item types: issues, PRs |
| **Google Calendar** | OAuth 2.0 (Google) | Push notifications + watch channels | Events API | Extended properties | Outbound-skewed (TaskFlow due_at → calendar event) |
| **Linear** | OAuth 2.0 / API key | Webhooks (HMAC) | GraphQL | Issue label or description marker | Status maps cleanly |
| **ClickUp** | OAuth 2.0 / API token | Webhooks (HMAC) | REST | Custom field | Similar to Jira |
| **Zendesk** | OAuth 2.0 / API token | Triggers + Targets (HTTP) | REST | Ticket field | Direct competitor to Freshdesk; same pattern |
| **Salesforce** | OAuth 2.0 (JWT or web flow) | Platform Events / Streaming API | REST + Bulk | Custom field | Enterprise-only plan-tier likely |
| **Microsoft Teams** | OAuth 2.0 (Graph) | Subscriptions / Bot Framework | Graph API | Activity ID | Outbound notifications first |
| **HubSpot** | OAuth 2.0 / private app | Webhooks (HMAC) | REST | Property | CRM contact ↔ TaskFlow project member |

### Capability matrix (drives Connector protocol shape)

- **Inbound-only** providers (e.g. Calendly, Stripe events) — `auth_method=WEBHOOK_ONLY`, no `push_item` implementation needed; protocol must allow `push_item` to be optional/raise `NotImplementedError`.
- **OAuth providers** — platform owns the OAuth dance; connector declares scopes + token URLs in `connect_form_schema`. `OAUTH_CALLBACK` capability triggers a redirect-handler route (`/integrations/{provider}/oauth/callback`).
- **Multi-account-per-org** providers (Slack workspaces, Jira sites) — `INTEGRATION#{provider}#{id}` already supports many records per org per provider; nothing extra needed.
- **Bidirectional with mandatory loop guard** (Slack, Jira, Linear) — the `detect_echo` / `stamp_outbound` pair must work for all of them, hence its presence on the Protocol.

### Hard constraint

If at any point we discover the Connector protocol cannot represent a high-priority provider without a breaking change, **stop** and revise the protocol before shipping more connectors. The first three connectors after Freshworks (Slack, Jira, Google Calendar) are the validation set — they exercise OAuth, HMAC, push-only, multi-account, and rich field mapping respectively.
