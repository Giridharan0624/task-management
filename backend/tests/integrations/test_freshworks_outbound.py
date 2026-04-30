"""Outbound tests covering push_item, sync_id stamping, echo round-trip,
and 401/429 error paths.
"""
from __future__ import annotations

from contextlib import contextmanager

import pytest

from contexts.integrations.connectors.freshworks import connector as connector_module
from contexts.integrations.connectors.freshworks.connector import FreshworksConnector
from contexts.integrations.connectors.freshworks.rest_client import (
    FreshworksAuthError,
    FreshworksHttpError,
)
from contexts.integrations.domain.credentials import Credentials
from contexts.integrations.domain.entities import ExternalLink
from contexts.integrations.domain.normalized import ItemPatch, NormalizedItem
from contexts.integrations.domain.value_objects import ItemType


def _link() -> ExternalLink:
    return ExternalLink.create(
        org_id="acme",
        provider="freshdesk",
        integration_id="i_1",
        item_type=ItemType.TASK,
        item_id="t_1",
        external_id="999",
    )


def _creds() -> Credentials:
    return Credentials(
        secret_payload={"subdomain": "acme", "api_key": "k", "product": "freshdesk"}
    )


@contextmanager
def _patched_clients(monkeypatch: pytest.MonkeyPatch, *, raise_exc=None, captured=None):
    class _Stub:
        def __init__(self, *, subdomain: str, api_key: str):
            self.subdomain = subdomain

        def update_ticket(self, ticket_id, body):
            if raise_exc is not None:
                raise raise_exc
            if captured is not None:
                captured["ticket_id"] = ticket_id
                captured["body"] = body
            return {"id": ticket_id, "updated_at": "2026-04-30T12:00:00Z"}

        def get_ticket(self, ticket_id, include=None):
            return {"id": ticket_id, "subject": "x"}

        def me(self):
            return {"id": 1}

        def get_agent(self, agent_id):
            return {"contact": {"email": "agent@acme.com"}}

    monkeypatch.setattr(connector_module, "FreshdeskClient", _Stub)
    monkeypatch.setattr(connector_module, "FreshserviceClient", _Stub)
    yield


def test_push_item_success_returns_etag(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}
    with _patched_clients(monkeypatch, captured=captured):
        c = FreshworksConnector()
        result = c.push_item(_creds(), _link(), ItemPatch(title="new", status="RESOLVED"))
    assert result.success is True
    assert result.etag == "2026-04-30T12:00:00Z"
    assert captured["ticket_id"] == "999"
    assert captured["body"]["subject"] == "new"
    assert captured["body"]["status"] == 4


def test_push_item_with_sync_id_stamps_custom_field(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}
    with _patched_clients(monkeypatch, captured=captured):
        c = FreshworksConnector()
        patch = c.stamp_outbound(ItemPatch(title="x"), "sync-abc")
        c.push_item(_creds(), _link(), patch)
    assert captured["body"]["custom_fields"]["cf_taskflow_sync_id"] == "sync-abc"


def test_push_item_auth_failure_returns_auth_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    with _patched_clients(monkeypatch, raise_exc=FreshworksAuthError("nope")):
        c = FreshworksConnector()
        result = c.push_item(_creds(), _link(), ItemPatch(title="x"))
    assert result.success is False
    assert result.error == "auth_failed"


def test_push_item_429_returns_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    with _patched_clients(monkeypatch, raise_exc=FreshworksHttpError(429, "rate limited")):
        c = FreshworksConnector()
        result = c.push_item(_creds(), _link(), ItemPatch(title="x"))
    assert result.success is False
    assert result.error == "http_429"


def test_push_item_empty_patch_is_silent_success(monkeypatch: pytest.MonkeyPatch) -> None:
    with _patched_clients(monkeypatch):
        c = FreshworksConnector()
        result = c.push_item(_creds(), _link(), ItemPatch())
    assert result.success is True


def test_round_trip_echo_detection() -> None:
    """Stamp an outbound patch with sync_id, then simulate an inbound item
    carrying the same sync_id in custom_fields. detect_echo must return True."""
    c = FreshworksConnector()
    sync_id = "abc-123"
    patch = c.stamp_outbound(ItemPatch(title="x"), sync_id)
    assert patch.sync_id == sync_id

    # The platform writes sync_id to outbox; the connector stamps it on the
    # outbound body via patch_to_freshworks_body. Inbound carries it in the
    # custom_fields → NormalizedItem.metadata.cf_taskflow_sync_id.
    inbound_item = NormalizedItem(
        external_id="999", metadata={"cf_taskflow_sync_id": sync_id}
    )
    assert c.detect_echo(inbound_item, {sync_id}) is True
    assert c.detect_echo(inbound_item, {"different"}) is False
