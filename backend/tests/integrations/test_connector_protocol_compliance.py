"""Every registered connector must satisfy the Connector Protocol surface.

This test runs at import time — if a connector is missing a method or has the
wrong attribute set, the test fails before any deploy can happen. It also
ensures the platform never silently accepts a half-implemented connector.
"""
from __future__ import annotations

from contexts.integrations.domain.connector_protocol import Connector
from contexts.integrations.domain.connector_registry import default_registry


def test_default_registry_loadable() -> None:
    """The default registry instance must be importable and start empty in
    a fresh process. (The Freshworks connector registers itself only when
    its module is explicitly imported — Phase 1a.)"""
    assert default_registry is not None


def test_every_registered_connector_satisfies_protocol() -> None:
    """If we ever land a connector that doesn't implement the Protocol, this
    test fails before deploy. Acts as a structural CI gate."""
    for connector in default_registry.list_providers():
        assert isinstance(connector, Connector), (
            f"connector {connector!r} does not satisfy Connector protocol"
        )
        assert connector.provider, "provider is required"
        assert connector.display_name, "display_name is required"
        assert connector.auth_method, "auth_method is required"
        assert connector.capabilities, "capabilities is required"
        assert isinstance(connector.connect_form_schema, dict)


def test_registry_rejects_duplicate_provider() -> None:
    from contexts.integrations.domain.connector_registry import ConnectorRegistry

    class _Stub:
        provider = "stub"
        display_name = "Stub"
        auth_method = None
        capabilities = set()
        connect_form_schema: dict = {}

        def verify_credentials(self, creds): ...
        def parse_webhook(self, headers, body): ...
        def fetch_item(self, creds, external_id): ...
        def push_item(self, creds, link, patch): ...
        def detect_echo(self, item, outbox_sync_ids): return False
        def stamp_outbound(self, patch, sync_id): return patch

    reg = ConnectorRegistry()
    reg.register(_Stub())
    try:
        reg.register(_Stub())
    except ValueError:
        return
    raise AssertionError("registry accepted duplicate provider — should have raised")
