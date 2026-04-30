from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable

from contexts.integrations.domain.credentials import AccountInfo, Credentials
from contexts.integrations.domain.entities import ExternalLink
from contexts.integrations.domain.normalized import (
    ItemPatch,
    NormalizedEvent,
    NormalizedItem,
)
from contexts.integrations.domain.value_objects import AuthMethod, Capability


class PushResult:
    """Connectors return one of these from push_item. The platform uses it to
    update last_pushed_at / etag on the ExternalLink."""

    def __init__(self, success: bool, etag: Optional[str] = None, error: Optional[str] = None):
        self.success = success
        self.etag = etag
        self.error = error


@runtime_checkable
class Connector(Protocol):
    """Every 3rd-party provider plugs in by implementing this Protocol.

    Platform code only ever talks to connectors through this surface — never
    by importing a concrete connector module. The registry resolves
    `provider -> Connector` at request time.
    """

    provider: str
    display_name: str
    auth_method: AuthMethod
    capabilities: set[Capability]
    connect_form_schema: dict[str, Any]

    def verify_credentials(self, creds: Credentials) -> AccountInfo:
        """Hit the provider's whoami-style endpoint to validate creds. Raises
        on auth failure; returns AccountInfo on success."""
        ...

    def parse_webhook(
        self, headers: dict[str, str], body: bytes
    ) -> Optional[NormalizedEvent]:
        """Translate a raw webhook payload into a NormalizedEvent. May return
        None when the payload should be ignored (heartbeat, unrelated event)."""
        ...

    def fetch_item(self, creds: Credentials, external_id: str) -> NormalizedItem:
        """Reconcile against the provider's REST API to get authoritative state."""
        ...

    def push_item(
        self, creds: Credentials, link: ExternalLink, patch: ItemPatch
    ) -> PushResult:
        """Apply a TaskFlow-side change back to the provider."""
        ...

    def detect_echo(self, item: NormalizedItem, outbox_sync_ids: set[str]) -> bool:
        """Return True if the inbound item carries a sync_id we just wrote
        outbound — i.e. it's an echo of our own change and should be dropped."""
        ...

    def stamp_outbound(self, patch: ItemPatch, sync_id: str) -> ItemPatch:
        """Embed a sync_id into the outbound patch so a future inbound webhook
        can be detected as our own echo."""
        ...
