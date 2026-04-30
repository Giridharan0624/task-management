from __future__ import annotations

from typing import Optional

from contexts.integrations.domain.connector_protocol import Connector


class ConnectorNotFoundError(KeyError):
    pass


class ConnectorRegistry:
    """Process-wide map of provider name -> Connector. The platform always
    looks up connectors through this surface so it can stay agnostic of which
    providers are installed.

    Connectors register themselves at module import time:

        from contexts.integrations.domain.connector_registry import default_registry
        default_registry.register(FreshworksConnector())
    """

    def __init__(self) -> None:
        self._connectors: dict[str, Connector] = {}

    def register(self, connector: Connector) -> None:
        if connector.provider in self._connectors:
            raise ValueError(f"connector {connector.provider} already registered")
        self._connectors[connector.provider] = connector

    def get(self, provider: str) -> Connector:
        try:
            return self._connectors[provider]
        except KeyError as exc:
            raise ConnectorNotFoundError(provider) from exc

    def try_get(self, provider: str) -> Optional[Connector]:
        return self._connectors.get(provider)

    def list_providers(self) -> list[Connector]:
        return list(self._connectors.values())

    def has(self, provider: str) -> bool:
        return provider in self._connectors

    def clear(self) -> None:
        self._connectors.clear()


default_registry = ConnectorRegistry()
