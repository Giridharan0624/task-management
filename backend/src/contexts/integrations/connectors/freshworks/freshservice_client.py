"""Freshservice-specific client surface.

Same shape as FreshdeskClient — different base URL (api/v2 on
{subdomain}.freshservice.com) and slightly different ticket payload (e.g.
`requester_id` vs `responder_id` for assignee). The connector picks
between the two clients based on `creds.public_metadata['product']`.

Endpoints used by the v1 connector:
  - GET /agents/me                   → verify credentials
  - GET /agents/{id}                 → resolve agent email
  - GET /tickets/{id}                → reconcile inbound webhook
  - PUT /tickets/{id}                → push outbound update
"""
from __future__ import annotations

from typing import Any

from contexts.integrations.connectors.freshworks.rest_client import (
    FreshworksRestClient,
)


class FreshserviceClient:
    def __init__(self, *, subdomain: str, api_key: str):
        self._rest = FreshworksRestClient(
            subdomain=subdomain, api_key=api_key, product="freshservice"
        )
        self.subdomain = subdomain

    def me(self) -> dict[str, Any]:
        # Freshservice wraps its agent record in {"agent": {...}} unlike
        # Freshdesk's bare object — the connector flattens this when
        # building AccountInfo.
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
