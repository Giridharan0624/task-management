"""Freshworks connector — supports Freshdesk and Freshservice.

The provider name on the connection record is `freshdesk` for both; the
`product` field in the credentials decides which REST base URL the client
uses. This keeps a single connector module covering both products without
duplicating Protocol boilerplate.
"""
from __future__ import annotations

from typing import Optional

from contexts.integrations.connectors.freshworks.connect_form_schema import (
    CONNECT_FORM_SCHEMA,
)
from contexts.integrations.connectors.freshworks.field_map import (
    patch_to_freshworks_body,
    ticket_to_normalized_item,
)
from contexts.integrations.connectors.freshworks.freshdesk_client import (
    FreshdeskClient,
)
from contexts.integrations.connectors.freshworks.freshservice_client import (
    FreshserviceClient,
)
from contexts.integrations.connectors.freshworks.rest_client import (
    FreshworksAuthError,
    FreshworksHttpError,
)
from contexts.integrations.connectors.freshworks.webhook_parser import (
    parse_workflow_automator_payload,
)
from contexts.integrations.domain.connector_protocol import Connector, PushResult
from contexts.integrations.domain.credentials import AccountInfo, Credentials
from contexts.integrations.domain.entities import ExternalLink
from contexts.integrations.domain.normalized import (
    ItemPatch,
    NormalizedEvent,
    NormalizedItem,
)
from contexts.integrations.domain.value_objects import AuthMethod, Capability


_SYNC_ID_FIELD = "cf_taskflow_sync_id"
# Time-window fallback when the customer's Freshdesk plan disallows custom
# fields. If an inbound webhook fires within this many seconds of our last
# outbound write to the same item, we drop it as a likely echo. Brittle
# (clock skew, real human edits in the same window) but better than a loop.
_FALLBACK_ECHO_WINDOW_S = 30


class FreshworksConnector:
    """Single connector covering Freshdesk + Freshservice. Differs only by
    REST base URL — picked at runtime from credentials.public_metadata."""

    provider: str = "freshdesk"
    display_name: str = "Freshdesk / Freshservice"
    auth_method: AuthMethod = AuthMethod.API_KEY
    capabilities: set[Capability] = {
        Capability.READ_ITEMS,
        Capability.WRITE_ITEMS,
        Capability.RECEIVE_WEBHOOKS,
    }
    connect_form_schema: dict = CONNECT_FORM_SCHEMA

    def verify_credentials(self, creds: Credentials) -> AccountInfo:
        """Hit `/agents/me` on the appropriate product to validate the API
        key + subdomain pair. Returns AccountInfo on success; raises a
        meaningful error on auth/HTTP failure that the use case wraps into
        a friendly ValidationError for the admin."""
        payload = creds.secret_payload or {}
        subdomain = (payload.get("subdomain") or "").strip().lower()
        api_key = (payload.get("api_key") or "").strip()
        product = (payload.get("product") or "freshdesk").strip().lower()

        if not subdomain or not api_key:
            raise ValueError("subdomain and api_key are required")
        if product not in ("freshdesk", "freshservice"):
            raise ValueError(f"unsupported product: {product}")

        client = (
            FreshdeskClient(subdomain=subdomain, api_key=api_key)
            if product == "freshdesk"
            else FreshserviceClient(subdomain=subdomain, api_key=api_key)
        )

        try:
            agent = client.me()
        except FreshworksAuthError:
            raise ValueError("Freshworks rejected the API key for this subdomain")
        except FreshworksHttpError as e:
            if e.status == 404:
                raise ValueError(
                    f"No {product} account found at {subdomain}.{('freshdesk.com' if product == 'freshdesk' else 'freshservice.com')}"
                )
            raise ValueError(f"Freshworks request failed: {e}")

        # Freshservice wraps the agent under {"agent": {...}}; Freshdesk
        # returns the bare agent object. Flatten before reading fields.
        if "agent" in agent and isinstance(agent["agent"], dict):
            agent = agent["agent"]

        contact = agent.get("contact") or {}
        display = (
            contact.get("name")
            or agent.get("name")
            or contact.get("email")
            or agent.get("email")
            or subdomain
        )
        return AccountInfo(
            account_id=str(agent.get("id") or subdomain),
            display_name=str(display),
            extra={"product": product, "subdomain": subdomain},
        )

    def parse_webhook(
        self, headers: dict[str, str], body: bytes
    ) -> Optional[NormalizedEvent]:
        return parse_workflow_automator_payload(headers, body)

    def fetch_item(self, creds: Credentials, external_id: str) -> NormalizedItem:
        payload = creds.secret_payload or {}
        subdomain = (payload.get("subdomain") or "").strip().lower()
        api_key = (payload.get("api_key") or "").strip()
        product = (payload.get("product") or "freshdesk").strip().lower()

        client = (
            FreshdeskClient(subdomain=subdomain, api_key=api_key)
            if product == "freshdesk"
            else FreshserviceClient(subdomain=subdomain, api_key=api_key)
        )
        ticket = client.get_ticket(external_id)
        item = ticket_to_normalized_item(ticket, subdomain=subdomain, product=product)

        responder_id = (item.metadata or {}).get("responder_id")
        if responder_id:
            try:
                agent = client.get_agent(responder_id)
                if "agent" in agent and isinstance(agent["agent"], dict):
                    agent = agent["agent"]
                contact = agent.get("contact") or {}
                email = contact.get("email") or agent.get("email")
                if email:
                    item.assignee_email = email
            except Exception:
                # Agent lookup is best-effort. A missing agent never fails
                # the whole sync — the task simply lands unassigned.
                pass
        return item

    def push_item(
        self, creds: Credentials, link: ExternalLink, patch: ItemPatch
    ) -> PushResult:
        payload = creds.secret_payload or {}
        subdomain = (payload.get("subdomain") or "").strip().lower()
        api_key = (payload.get("api_key") or "").strip()
        product = (payload.get("product") or "freshdesk").strip().lower()

        client = (
            FreshdeskClient(subdomain=subdomain, api_key=api_key)
            if product == "freshdesk"
            else FreshserviceClient(subdomain=subdomain, api_key=api_key)
        )

        body = patch_to_freshworks_body(
            title=patch.title,
            description=patch.description,
            status=patch.status,
            priority=patch.priority,
            due_at=patch.due_at,
            tags=patch.tags,
            sync_id=patch.sync_id,
        )
        if not body:
            return PushResult(success=True)  # nothing to write

        try:
            response = client.update_ticket(link.external_id, body)
        except FreshworksAuthError:
            return PushResult(success=False, error="auth_failed")
        except FreshworksHttpError as e:
            return PushResult(success=False, error=f"http_{e.status}")
        except Exception as e:  # noqa: BLE001
            return PushResult(success=False, error=str(e))

        etag = None
        if isinstance(response, dict):
            etag = response.get("updated_at") or str(response.get("id") or "")
        return PushResult(success=True, etag=etag)

    def detect_echo(
        self, item: NormalizedItem, outbox_sync_ids: set[str]
    ) -> bool:
        # Primary: custom-field sentinel. The connector stamps it on every
        # outbound write; an inbound payload still carrying it (and matching
        # an in-flight outbox entry) is our own echo.
        candidate = (item.metadata or {}).get(_SYNC_ID_FIELD)
        if isinstance(candidate, str) and candidate in outbox_sync_ids:
            return True
        # Time-window fallback handled in upsert_task_from_external against
        # ExternalLink.last_pushed_at — see ENV-driven config there.
        return False

    def stamp_outbound(self, patch: ItemPatch, sync_id: str) -> ItemPatch:
        patch.sync_id = sync_id
        return patch
