"""Translate a Freshworks Workflow Automator webhook payload into a
provider-agnostic NormalizedEvent.

Freshdesk/Freshservice webhooks are admin-templated — the body shape is
whatever the admin pasted in the Workflow Automator rule. We document a
canonical body in our setup instructions and then defensively parse it.

Recommended body (set in our setup guide):
    {
      "ticket_id": "{{ticket.id}}",
      "event": "{{Triggered event}}",
      "subdomain": "{{helpdesk_name}}",
      "updated_at": "{{ticket.updated_at}}"
    }

We tolerate variations — any payload with a recognizable ticket_id passes.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from contexts.integrations.domain.normalized import NormalizedEvent
from contexts.integrations.domain.value_objects import ChangeType, ItemType


log = logging.getLogger(__name__)


_EVENT_MAP = {
    "ticket created": ChangeType.CREATED,
    "ticket_created": ChangeType.CREATED,
    "ticket.created": ChangeType.CREATED,
    "ticket updated": ChangeType.UPDATED,
    "ticket_updated": ChangeType.UPDATED,
    "ticket.updated": ChangeType.UPDATED,
    "ticket deleted": ChangeType.DELETED,
    "ticket_deleted": ChangeType.DELETED,
    "ticket.deleted": ChangeType.DELETED,
}


def parse_workflow_automator_payload(
    headers: dict[str, str],
    body: bytes,
) -> Optional[NormalizedEvent]:
    """Best-effort parse. Returns None for payloads that don't carry an
    identifiable ticket id — the dispatcher treats None as 'ignore quietly'."""
    if not body:
        return None

    try:
        decoded = body.decode("utf-8") if isinstance(body, bytes) else body
        payload = json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError):
        log.info("freshworks webhook: body is not valid JSON; ignoring")
        return None

    # Most-common shape: top-level ticket_id (admin-templated).
    external_id = _coerce_id(
        payload.get("ticket_id")
        or payload.get("freshdesk_webhook", {}).get("ticket_id")
        or payload.get("ticket", {}).get("id")
    )
    if external_id is None:
        log.info("freshworks webhook: no recognizable ticket id; ignoring")
        return None

    event_str = (
        str(payload.get("event") or payload.get("Triggered event") or "ticket.updated")
        .strip()
        .lower()
    )
    change_type = _EVENT_MAP.get(event_str, ChangeType.UPDATED)

    return NormalizedEvent(
        provider="freshdesk",
        integration_id="",  # filled in by webhook_dispatch before enqueue
        external_id=external_id,
        item_type=ItemType.TASK,
        change_type=change_type,
        received_at=datetime.now(timezone.utc).isoformat(),
        raw_metadata={"event_text": event_str, "subdomain_in_body": payload.get("subdomain")},
    )


def _coerce_id(value) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None
