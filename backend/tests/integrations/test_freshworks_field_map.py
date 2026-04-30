"""Field-map round-trip tests."""
from __future__ import annotations

import pytest

from contexts.integrations.connectors.freshworks.field_map import (
    patch_to_freshworks_body,
    ticket_to_normalized_item,
)


def test_freshdesk_ticket_maps_to_normalized() -> None:
    ticket = {
        "id": 12345,
        "subject": "Login broken",
        "description_text": "I cannot log in.",
        "status": 2,
        "priority": 3,
        "responder_id": 999,
        "requester_id": 111,
        "due_by": "2026-05-01T10:00:00Z",
        "tags": ["urgent", "ux"],
        "updated_at": "2026-04-30T09:00:00Z",
        "custom_fields": {"cf_taskflow_sync_id": "abc"},
    }
    item = ticket_to_normalized_item(ticket, subdomain="acme", product="freshdesk")
    assert item.external_id == "12345"
    assert item.external_url == "https://acme.freshdesk.com/a/tickets/12345"
    assert item.title == "Login broken"
    assert item.status == "OPEN"
    assert item.priority == "HIGH"
    assert item.tags == ["urgent", "ux"]
    assert item.metadata["cf_taskflow_sync_id"] == "abc"
    assert item.metadata["responder_id"] == 999


def test_status_priority_enum_values() -> None:
    expected_status = {(2, "OPEN"), (3, "PENDING"), (4, "RESOLVED"), (5, "CLOSED")}
    for code, normalized in expected_status:
        item = ticket_to_normalized_item({"id": 1, "status": code})
        assert item.status == normalized

    expected_priority = {(1, "LOW"), (2, "MEDIUM"), (3, "HIGH"), (4, "URGENT")}
    for code, normalized in expected_priority:
        item = ticket_to_normalized_item({"id": 1, "priority": code})
        assert item.priority == normalized


def test_html_description_is_stripped() -> None:
    ticket = {
        "id": 1,
        "description": "<p>Hello&nbsp;<b>world</b> &amp; friends</p>",
    }
    item = ticket_to_normalized_item(ticket)
    assert item.description == "Hello world & friends"


def test_freshservice_envelope_is_unwrapped() -> None:
    payload = {"ticket": {"id": 7, "subject": "x", "status": 4}}
    item = ticket_to_normalized_item(payload, subdomain="acme", product="freshservice")
    assert item.external_id == "7"
    assert item.status == "RESOLVED"
    assert item.external_url == "https://acme.freshservice.com/a/tickets/7"


def test_missing_id_raises() -> None:
    with pytest.raises(ValueError, match="missing id"):
        ticket_to_normalized_item({"subject": "x"})


def test_patch_body_only_includes_set_fields() -> None:
    body = patch_to_freshworks_body(title="New title", status="RESOLVED")
    assert body == {"subject": "New title", "status": 4}


def test_patch_body_stamps_sync_id_into_custom_fields() -> None:
    body = patch_to_freshworks_body(sync_id="sync-abc")
    assert body == {"custom_fields": {"cf_taskflow_sync_id": "sync-abc"}}


def test_patch_body_unknown_status_is_dropped_not_raised() -> None:
    body = patch_to_freshworks_body(status="WAT", title="x")
    assert "status" not in body
    assert body["subject"] == "x"


def test_patch_body_priority_mapping() -> None:
    body = patch_to_freshworks_body(priority="URGENT")
    assert body == {"priority": 4}
