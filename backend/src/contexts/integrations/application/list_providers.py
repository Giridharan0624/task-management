from __future__ import annotations

from contexts.integrations.domain.connector_protocol import Connector
from contexts.integrations.domain.connector_registry import ConnectorRegistry


def list_providers(registry: ConnectorRegistry) -> list[dict]:
    """Public catalog shown in the UI. Driven entirely by what's registered —
    adding a new connector makes it appear in /integrations/providers without
    any platform code changes."""
    return [provider_to_public_dict(c) for c in registry.list_providers()]


def provider_to_public_dict(connector: Connector) -> dict:
    return {
        "provider": connector.provider,
        "display_name": connector.display_name,
        "auth_method": connector.auth_method.value,
        "capabilities": sorted(c.value for c in connector.capabilities),
        "connect_form_schema": connector.connect_form_schema,
    }
