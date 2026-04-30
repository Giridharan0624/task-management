# Slack Connector — Plan

Status: **Proposed (not started).** This doc exists to **stress-test the
Connector Protocol** against a provider that exercises everything Freshworks
didn't (OAuth 2.0, HMAC-signed webhooks, multi-account-per-org, real-time
events). If anything in the design here forces a Protocol change, raise it
before writing code — that's the whole point of doing this on paper first.

Pair with:
- [INTEGRATION-PLATFORM-PLAN.md](INTEGRATION-PLATFORM-PLAN.md) — overall architecture.
- [INTEGRATIONS-RUNBOOK.md](../guides/INTEGRATIONS-RUNBOOK.md) — adding a new connector.

---

## 1. Goal & v1 scope

Let TaskFlow orgs connect their Slack workspace and:

- **Outbound:** when a TaskFlow task is created/updated/assigned, post a
  message to a configured Slack channel. Update the same message in place
  on subsequent task changes (so we don't spam channels).
- **Inbound:** when someone reacts with a configured emoji on a Slack
  message (e.g. `:taskflow:`), create a TaskFlow task seeded from that
  message's content. *Optional v1.5: turn Slack threads into TaskFlow
  comments.*
- **Multi-workspace:** an org with two Slack workspaces (typical for
  consultancies) can connect both as separate integration records.

### Explicit non-goals for v1

- Slash commands (`/taskflow create ...`) — needs interactive command
  handling and command response time budgets; defer.
- Modal dialogs / Block Kit interactivity — same reasoning.
- DM-based task creation — privacy + permission story is gnarly, defer.
- Slack → TaskFlow user provisioning. Treat Slack users as anonymous
  unless their Slack email matches a TaskFlow user (same `assignee_mode`
  policy as Freshworks).

---

## 2. Protocol stress-test — what's different from Freshworks

| Concern | Freshworks (v1) | Slack (this plan) | Protocol implication |
|---|---|---|---|
| Auth method | API_KEY (Basic) | **OAUTH2** (3-legged) | Protocol must accommodate an OAuth callback step |
| Credentials shape | `{subdomain, api_key, product}` | `{access_token, bot_user_id, team_id, scope}` | Already opaque (`Credentials.secret_payload: dict`). ✅ Fine. |
| Webhook signature | None — bearer-in-URL | **HMAC SHA256** signed body (`X-Slack-Signature`) | `parse_webhook(headers, body)` already takes both. ✅ Fine — connector raises on bad signature. |
| Multi-account-per-org | Each Freshdesk subdomain is its own integration | Each Slack workspace is its own integration | `INTEGRATION#{provider}#{id}` already keyed by id, not by provider alone. ✅ Fine. |
| Echo-loop guard | Custom field on ticket | **Message metadata** (`metadata.event_type` namespace) | `detect_echo`/`stamp_outbound` already on Protocol, both take `ItemPatch`/`NormalizedItem`. ✅ Fine. |
| Outbound semantics | PUT replaces fields | `chat.update` keeps message_ts, replaces text + blocks | `push_item` returns `etag` — Slack's `ts` works as an etag. ✅ Fine. |
| Connect-form schema | Plain text fields | Needs an OAuth redirect button (cannot be a text input) | **Protocol gap — see §3 below** |
| Provider-side rate limits | Per-account, ~200/min | **Tier-based** (Tier 3: 50+/min, Tier 4: 100+/min); enforced per-method | Connector internalizes; Protocol unaffected. ✅ Fine. |

**Verdict: one Protocol gap** — the OAuth redirect button case (§3). Everything
else fits cleanly.

---

## 3. Protocol gap — OAuth redirect in the connect form

### The problem

Freshworks' connect form is a flat list of text inputs the admin types
into. The platform's `DynamicConnectForm` renders the schema as `<Input>`
elements and submits the values directly to `POST /integrations/{provider}`.

Slack's connect flow is structurally different:

1. User clicks **"Add to Slack"** in the TaskFlow UI.
2. Browser redirects to `https://slack.com/oauth/v2/authorize?...&redirect_uri=<our-callback>`.
3. User picks a Slack workspace, approves scopes.
4. Slack redirects back to TaskFlow's callback URL with a `code`.
5. TaskFlow's callback handler exchanges the `code` for an `access_token`
   via `oauth.v2.access` (server-to-server), persists the integration,
   and redirects the user to the success screen.

The platform doesn't currently have a "callback" route, and the connect
form doesn't currently know how to render an OAuth button.

### Two ways to close the gap

**Option A — Generic OAuth callback route in the platform.**

Add `/integrations/{provider}/oauth/callback` (and `/start`) to the
admin_router. The connector declares `auth_method=OAUTH2` and
`capabilities={..., OAUTH_CALLBACK}`; the platform's connect form
renders an "Add to Slack" button that hits `/start`, which redirects to
the connector's `oauth_authorize_url(state)`. After consent, Slack
redirects to `/oauth/callback`, which calls `connector.exchange_code(code)
→ Credentials` and proceeds with the normal `verify_credentials → save`
flow.

Pros: clean, every OAuth provider reuses the same routes.
Cons: 2 new routes + Lambdas (or 2 new path branches in admin_router),
small platform code addition.

**Option B — Connector returns an HTML redirect from `verify_credentials`.**

Hack: connector's `verify_credentials` returns a "you need to redirect"
sentinel, the connect handler 302s the browser. Cleaner with a
sub-package layer but messier overall, and doesn't generalize to
providers that need a multi-step setup (Slack scopes selection, Jira
3LO).

### Recommendation: Option A

Adds two new fields to the Protocol:

```python
class Connector(Protocol):
    ...
    # When auth_method is OAUTH2, the platform calls these instead of
    # rendering connect_form_schema.fields:
    def oauth_authorize_url(self, state: str, redirect_uri: str) -> str: ...
    def exchange_code(self, code: str, redirect_uri: str) -> Credentials: ...
```

Both methods are no-ops on API_KEY connectors. The Protocol becomes
version 2; existing Freshworks connector adds `oauth_authorize_url` and
`exchange_code` as stubs that `raise NotImplementedError` — never called
because `auth_method=API_KEY`.

**Add to the additivity CI**: a test that verifies any connector with
`auth_method=OAUTH2` implements both methods.

---

## 4. Module layout

```
backend/src/contexts/integrations/connectors/slack/
├── __init__.py                   # imports SlackConnector for registry side-effect
├── connect_form_schema.py        # minimal — just the OAuth button declaration
├── slack_client.py               # httpx wrapper around api.slack.com (chat.postMessage, chat.update, oauth.v2.access)
├── oauth.py                      # state-token generation + redirect URL + code exchange
├── webhook_parser.py             # Events API payload → NormalizedEvent
├── signature.py                  # HMAC SHA256 verification (X-Slack-Signature, X-Slack-Request-Timestamp)
├── field_map.py                  # Slack message ↔ NormalizedItem
├── echo_strategy.py              # message metadata sentinel
└── connector.py                  # SlackConnector(Connector)
```

---

## 5. Field mapping

### Slack outbound (TaskFlow task → Slack message)

| TaskFlow task | Slack `chat.postMessage` / `chat.update` |
|---|---|
| `task.title` | First line of message text + Block Kit header |
| `task.description` | Plain text section |
| `task.status` | Emoji prefix on the header (🟡 in_progress, ✅ done, etc.) |
| `task.priority` | Sidebar block / colored attachment |
| `task.assigned_to[0]` (email) | Slack user mention via `users.lookupByEmail` |
| `task.deadline` | Human-readable relative time in a context block |
| (synthetic) | Hidden `metadata.taskflow_sync_id` so detect_echo works |

### Slack inbound (emoji-reaction → NormalizedItem)

| Slack message | NormalizedItem |
|---|---|
| `message.text` | `title` (first 80 chars), `description` (rest) |
| `message.user` → email via `users.info` | `assignee_email` |
| `event.ts` | `external_id` |
| `metadata.event_type=='taskflow_task_request'` | (sentinel — connector's parse_webhook checks for this) |
| `event.event_ts` | `updated_at` |

### Echo strategy

Slack supports `metadata` on `chat.postMessage`. Stamp every outbound
write with:

```json
{
  "metadata": {
    "event_type": "taskflow_outbound",
    "event_payload": {"taskflow_sync_id": "<uuid>"}
  }
}
```

`detect_echo` reads `event_payload.taskflow_sync_id` from the inbound
event payload (Slack passes message metadata through on `message_changed`
events).

---

## 6. Webhook URL & signature

Slack Events API delivers to a single URL the admin sets in their Slack
app config — TaskFlow's `/integration-webhooks/slack/{org_id}/{integration_id}`.

**Signature verification** lives entirely inside `SlackConnector.parse_webhook`:

```python
def parse_webhook(self, headers, body):
    sig = headers.get("x-slack-signature")
    ts = headers.get("x-slack-request-timestamp")
    if not _verify_signature(self._signing_secret, sig, ts, body):
        return None  # silently drop unsigned/forged requests
    payload = json.loads(body)
    if payload.get("type") == "url_verification":
        # Slack pings this once when the URL is configured. Reply with the
        # challenge value — handled at the dispatch layer via a known
        # response sentinel.
        return NormalizedEvent.challenge(payload["challenge"])
    ...
```

`url_verification` is a Slack-specific quirk (the dispatcher needs to
echo back the `challenge` value within 3 seconds to confirm the URL).
**This is a second Protocol gap** — the dispatcher today doesn't have a
way to send a custom non-200 / non-202 response from `parse_webhook`.

**Fix:** add an optional `webhook_handshake_response()` method to the
Protocol that connectors override when they need to handle handshake
flows. Default returns None (200 OK). Slack's implementation returns
`{"challenge": "..."}` when the inbound is a url_verification.

---

## 7. Storage

DynamoDB SK patterns are already provider-namespaced — Slack reuses
them as-is:

```
PK=ORG#{org}  SK=INTEGRATION#slack#{id}                       Slack workspace connection
PK=ORG#{org}  SK=INTEGRATION#{id}#EVENT#{ts}#{uuid}            inbound event audit (30d TTL)
PK=ORG#{org}  SK=INTEGRATION#{id}#OUTBOX#{sync_id}             echo guard (5min TTL)
PK=ORG#{org}  SK=EXTLINK#slack#{message_ts}                    forward link
PK=ORG#{org}  SK=EXTLINK#ITEM#TASK#{task_id}#slack             reverse link
```

**No schema changes.** Same KMS key encrypts the OAuth tokens (just
different `secret_payload` shape — `{access_token, bot_user_id, team_id,
scope, refresh_token, expires_at}` for Slack vs `{subdomain, api_key,
product}` for Freshworks).

OAuth refresh handling: a scheduled Lambda (or lazy refresh on each
request) checks `expires_at`, calls `oauth.v2.access` with the refresh
token, and rotates the access token in-place. The connector's
`fetch_item`/`push_item` methods read `creds.secret_payload['access_token']`
fresh each call — no caching.

---

## 8. Plan gating

Same plan-gate as Freshworks — `enforce_can_connect` already counts
across all providers. No Slack-specific plan rules in v1; Pro/Enterprise
can connect Slack.

---

## 9. Phasing

| Phase | Scope | Gate |
|---|---|---|
| **0 — Protocol revision** | Add `oauth_authorize_url`, `exchange_code`, `webhook_handshake_response` to the Protocol. Update Freshworks connector with stubs. Update CI gates. | Existing 92 backend tests still pass + Freshworks unaffected |
| **2a — Slack connector skeleton** | Stubs satisfying the new Protocol; connect form schema renders the "Add to Slack" button | Provider catalog shows Slack tile |
| **2b — OAuth flow** | `/oauth/start` + `/oauth/callback` routes; `exchange_code` working against the real Slack API | Admin can complete consent and the integration record persists |
| **2c — Inbound** | Signature verification, `parse_webhook`, emoji-reaction → task creation | Verified on staging with a real Slack workspace |
| **2d — Outbound** | `push_item` posts/updates messages, sync_id stamping, echo detection | Round-trip verified on staging |
| **2e — UI** | OAuth redirect button, channel-picker on integration detail page | Internal dogfooding |
| **2f — Beta → GA** | Behind `slack_integration_beta` flag → one Pro customer → flag removed | Customer-validated |

Indicative cost per phase: 1–2 days each for a focused engineer. Phase
0 is the riskiest because it's the only time the Protocol changes;
everything after is connector-local.

---

## 10. Open questions

1. **OAuth callback URL — single or per-stage?** Slack apps require the
   redirect URL to match a registered list. Easiest is one URL per stage
   (`https://<integrations-api>/integrations/slack/oauth/callback`).
   Adding a second stage means re-registering in the Slack app config.
   Acceptable for v1.
2. **Bot vs user token.** Bot token is simpler (one bot per workspace,
   doesn't expire as often). Use bot token for v1; revisit user-token
   semantics for slash commands in v1.5.
3. **Channel selection.** Per-integration default channel? Per-task
   override? v1: per-integration default, configured via OAuth `incoming-webhook`
   scope. v1.5: per-project channel routing.
4. **Privacy.** Slack messages can contain PII. Storing
   `EXTLINK#slack#{message_ts}` is fine — that's just a key, not content.
   Storing message content in TaskFlow tasks is fine too — same data
   sensitivity as ticket subjects from Freshdesk. No additional storage
   concern.
5. **Auto-response.** When emoji-reaction creates a task, should the bot
   reply in-thread with the TaskFlow task URL? **Yes** — gives Slack
   users immediate confirmation. Defer the *opt-out* of this until users
   ask.

---

## 11. References

- [Slack Events API — request URLs & verification](https://api.slack.com/apis/connections/events-api)
- [Slack OAuth v2](https://api.slack.com/authentication/oauth-v2)
- [Slack signing secret verification](https://api.slack.com/authentication/verifying-requests-from-slack)
- [chat.postMessage with metadata](https://api.slack.com/methods/chat.postMessage#arg_metadata)
- Internal: [INTEGRATION-PLATFORM-PLAN.md](INTEGRATION-PLATFORM-PLAN.md), [connector_protocol.py](../../backend/src/contexts/integrations/domain/connector_protocol.py)
