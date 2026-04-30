"""Freshdesk-specific client surface.

Endpoints used by the v1 connector:
  - GET /agents/me                   → verify credentials, return AccountInfo
  - GET /agents/{id}                 → resolve agent email from responder_id
  - GET /tickets/{id}                → reconcile inbound webhook
  - PUT /tickets/{id}                → push outbound update
"""
from __future__ import annotations

from typing import Any

from contexts.integrations.connectors.freshworks.rest_client import (
    FreshworksRestClient,
)


class FreshdeskClient:
    def __init__(self, *, subdomain: str, api_key: str):
        self._rest = FreshworksRestClient(
            subdomain=subdomain, api_key=api_key, product="freshdesk"
        )
        self.subdomain = subdomain

    def me(self) -> dict[str, Any]:
        return self._rest.get("/agents/me").json() or {}

    def get_agent(self, agent_id: int | str) -> dict[str, Any]:
        return self._rest.get(f"/agents/{agent_id}").json() or {}

    def get_ticket(self, ticket_id: int | str, *, include: list[str] | None = None) -> dict[str, Any]:
        params: dict[str, Any] | None = None
        if include:
            params = {"include": ",".join(include)}
        return self._rest.get(f"/tickets/{ticket_id}", params=params).json() or {}

    def update_ticket(self, ticket_id: int | str, body: dict) -> dict[str, Any]:
        return self._rest.put(f"/tickets/{ticket_id}", body=body).json() or {}
