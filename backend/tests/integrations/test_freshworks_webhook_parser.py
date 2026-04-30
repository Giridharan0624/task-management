"""Unit tests for parse_workflow_automator_payload — every realistic
shape the admin might paste should result in a NormalizedEvent or a clean
None (never a raise).
"""
from __future__ import annotations

import json

import pytest

from contexts.integrations.connectors.freshworks.webhook_parser import (
    parse_workflow_automator_payload,
)
from contexts.integrations.domain.value_objects import ChangeType, ItemType


def _payload(d: dict) -> bytes:
    return json.dumps(d).encode("utf-8")


def test_canonical_template_parses() -> None:
    body = _payload(
        {
            "ticket_id": "12345",
            "event": "Ticket Updated",
            "subdomain": "acme",
            "updated_at": "2026-04-30T10:00:00Z",
        }
    )
    event = parse_workflow_automator_payload({}, body)
    assert event is not None
    assert event.external_id == "12345"
    assert event.change_type == ChangeType.UPDATED
    assert event.item_type == ItemType.TASK
    assert event.raw_metadata["subdomain_in_body"] == "acme"


def test_created_event_maps_to_created_change_type() -> None:
    body = _payload({"ticket_id": "9", "event": "ticket.created"})
    event = parse_workflow_automator_payload({}, body)
    assert event is not None
    assert event.change_type == ChangeType.CREATED


def test_deleted_event_maps_to_deleted_change_type() -> None:
    body = _payload({"ticket_id": "9", "event": "ticket_deleted"})
    event = parse_workflow_automator_payload({}, body)
    assert event is not None
    assert event.change_type == ChangeType.DELETED


def test_unknown_event_defaults_to_updated() -> None:
    body = _payload({"ticket_id": "9", "event": "something else"})
    event = parse_workflow_automator_payload({}, body)
    assert event is not None
    assert event.change_type == ChangeType.UPDATED


def test_nested_ticket_object_is_supported() -> None:
    body = _payload({"ticket": {"id": 42, "subject": "x"}, "event": "Ticket Created"})
    event = parse_workflow_automator_payload({}, body)
    assert event is not None
    assert event.external_id == "42"


def test_empty_body_returns_none() -> None:
    assert parse_workflow_automator_payload({}, b"") is None


def test_invalid_json_returns_none_no_raise() -> None:
    assert parse_workflow_automator_payload({}, b"not json") is None


def test_payload_without_ticket_id_returns_none() -> None:
    body = _payload({"event": "Ticket Updated", "subdomain": "acme"})
    assert parse_workflow_automator_payload({}, body) is None


def test_integer_ticket_id_is_coerced_to_string() -> None:
    body = _payload({"ticket_id": 42})
    event = parse_workflow_automator_payload({}, body)
    assert event is not None
    assert event.external_id == "42"
