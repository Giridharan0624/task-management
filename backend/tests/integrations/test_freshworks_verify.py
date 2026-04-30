"""Unit tests for FreshworksConnector.verify_credentials.

Exercises the success path (Freshdesk + Freshservice agent payload shapes),
the auth-failure path, and the missing-fields validation. The HTTP client is
patched so these tests run offline.
"""
from __future__ import annotations

from contextlib import contextmanager

import pytest

from contexts.integrations.connectors.freshworks import connector as connector_module
from contexts.integrations.connectors.freshworks.connector import FreshworksConnector
from contexts.integrations.connectors.freshworks.rest_client import (
    FreshworksAuthError,
)
from contexts.integrations.domain.credentials import Credentials


@contextmanager
def _patched_clients(
    monkeypatch: pytest.MonkeyPatch,
    *,
    freshdesk_response=None,
    freshservice_response=None,
    raise_auth: bool = False,
):
    class _Stub:
        def __init__(self, *, subdomain: str, api_key: str):
            self.subdomain = subdomain
            self.api_key = api_key

        def me(self):
            if raise_auth:
                raise FreshworksAuthError("nope")
            return _stub_response

    _stub_response = freshdesk_response or freshservice_response or {}
    monkeypatch.setattr(connector_module, "FreshdeskClient", _Stub)
    monkeypatch.setattr(connector_module, "FreshserviceClient", _Stub)
    yield


def test_verify_freshdesk_success(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"id": 12345, "contact": {"name": "Alice", "email": "alice@acme.com"}}
    with _patched_clients(monkeypatch, freshdesk_response=payload):
        c = FreshworksConnector()
        info = c.verify_credentials(
            Credentials(secret_payload={"subdomain": "acme", "api_key": "k", "product": "freshdesk"})
        )
    assert info.account_id == "12345"
    assert info.display_name == "Alice"
    assert info.extra["product"] == "freshdesk"
    assert info.extra["subdomain"] == "acme"


def test_verify_freshservice_unwraps_agent_envelope(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"agent": {"id": 7, "first_name": "Bob", "email": "bob@acme.com"}}
    with _patched_clients(monkeypatch, freshservice_response=payload):
        c = FreshworksConnector()
        info = c.verify_credentials(
            Credentials(secret_payload={"subdomain": "acme", "api_key": "k", "product": "freshservice"})
        )
    assert info.account_id == "7"
    assert info.extra["product"] == "freshservice"


def test_verify_rejects_bad_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    with _patched_clients(monkeypatch, raise_auth=True):
        c = FreshworksConnector()
        with pytest.raises(ValueError, match="rejected the API key"):
            c.verify_credentials(
                Credentials(secret_payload={"subdomain": "acme", "api_key": "bad", "product": "freshdesk"})
            )


def test_verify_requires_subdomain_and_api_key() -> None:
    c = FreshworksConnector()
    with pytest.raises(ValueError, match="required"):
        c.verify_credentials(Credentials(secret_payload={"subdomain": "", "api_key": "k"}))
    with pytest.raises(ValueError, match="required"):
        c.verify_credentials(Credentials(secret_payload={"subdomain": "acme", "api_key": ""}))


def test_verify_rejects_unknown_product() -> None:
    c = FreshworksConnector()
    with pytest.raises(ValueError, match="unsupported product"):
        c.verify_credentials(
            Credentials(secret_payload={"subdomain": "acme", "api_key": "k", "product": "freshchat"})
        )


def test_echo_detection_matches_sentinel_in_metadata() -> None:
    from contexts.integrations.domain.normalized import NormalizedItem

    c = FreshworksConnector()
    item = NormalizedItem(
        external_id="42", metadata={"cf_taskflow_sync_id": "abcdef"}
    )
    assert c.detect_echo(item, {"abcdef"}) is True
    assert c.detect_echo(item, {"different"}) is False


def test_stamp_outbound_sets_sync_id() -> None:
    from contexts.integrations.domain.normalized import ItemPatch

    c = FreshworksConnector()
    patch = c.stamp_outbound(ItemPatch(), "abc")
    assert patch.sync_id == "abc"
