"""Field mapping between Freshworks tickets and NormalizedItem.

Freshdesk and Freshservice use the same enum values for status (2/3/4/5) and
priority (1/2/3/4) on the ticket payload — only a few field names diverge
(e.g. responder_id vs `agent_id` on Freshservice in some plans, depending on
configuration). This module focuses on Freshdesk; Freshservice deviations
are handled in-line via fallbacks.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from contexts.integrations.domain.normalized import NormalizedItem


# Freshdesk numeric status codes (also used by Freshservice incidents).
_STATUS_TO_NORMAL = {
    2: "OPEN",
    3: "PENDING",
    4: "RESOLVED",
    5: "CLOSED",
}

_NORMAL_TO_STATUS = {v: k for k, v in _STATUS_TO_NORMAL.items()}

_PRIORITY_TO_NORMAL = {
    1: "LOW",
    2: "MEDIUM",
    3: "HIGH",
    4: "URGENT",
}

_NORMAL_TO_PRIORITY = {v: k for k, v in _PRIORITY_TO_NORMAL.items()}


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&(nbsp|amp|lt|gt|quot|#39);")


def ticket_to_normalized_item(
    ticket: dict[str, Any],
    *,
    subdomain: Optional[str] = None,
    product: str = "freshdesk",
) -> NormalizedItem:
    """Build a NormalizedItem from a raw Freshworks ticket payload."""
    if not isinstance(ticket, dict):
        raise ValueError("ticket payload must be a dict")

    # Freshservice may wrap under "ticket".
    if "ticket" in ticket and isinstance(ticket["ticket"], dict):
        ticket = ticket["ticket"]

    external_id = str(ticket.get("id") or "").strip()
    if not external_id:
        raise ValueError("ticket payload missing id")

    description = ticket.get("description_text")
    if not description:
        raw = ticket.get("description") or ""
        description = _strip_html(raw) if raw else None

    status_code = ticket.get("status")
    priority_code = ticket.get("priority")

    custom_fields = ticket.get("custom_fields") or {}
    sync_id = (
        custom_fields.get("cf_taskflow_sync_id")
        or custom_fields.get("taskflow_sync_id")
    )

    metadata: dict[str, Any] = {}
    if sync_id is not None:
        metadata["cf_taskflow_sync_id"] = sync_id
    metadata["responder_id"] = ticket.get("responder_id")
    metadata["requester_id"] = ticket.get("requester_id")
    metadata["product"] = product

    external_url = None
    if subdomain:
        host = "freshdesk.com" if product == "freshdesk" else "freshservice.com"
        external_url = f"https://{subdomain}.{host}/a/tickets/{external_id}"

    return NormalizedItem(
        external_id=external_id,
        external_url=external_url,
        title=ticket.get("subject"),
        description=description,
        status=_STATUS_TO_NORMAL.get(int(status_code)) if isinstance(status_code, (int, float)) else None,
        priority=_PRIORITY_TO_NORMAL.get(int(priority_code)) if isinstance(priority_code, (int, float)) else None,
        assignee_email=None,  # caller resolves via /agents/{responder_id}
        due_at=ticket.get("due_by"),
        tags=list(ticket.get("tags") or []),
        updated_at=ticket.get("updated_at"),
        metadata=metadata,
    )


def patch_to_freshworks_body(
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    responder_id: Optional[int | str] = None,
    due_at: Optional[str] = None,
    tags: Optional[list[str]] = None,
    sync_id: Optional[str] = None,
) -> dict[str, Any]:
    """Translate a TaskFlow-side change into a Freshdesk PUT /tickets body.

    Only fields that are non-None are included — Freshworks' PATCH semantics
    treat absent fields as 'leave unchanged'."""
    body: dict[str, Any] = {}
    if title is not None:
        body["subject"] = title
    if description is not None:
        body["description"] = description
    if status is not None:
        code = _NORMAL_TO_STATUS.get(status.upper())
        if code is not None:
            body["status"] = code
    if priority is not None:
        code = _NORMAL_TO_PRIORITY.get(priority.upper())
        if code is not None:
            body["priority"] = code
    if responder_id is not None:
        body["responder_id"] = responder_id
    if due_at is not None:
        body["due_by"] = due_at
    if tags is not None:
        body["tags"] = list(tags)
    if sync_id is not None:
        body.setdefault("custom_fields", {})["cf_taskflow_sync_id"] = sync_id
    return body


def _strip_html(text: str) -> str:
    no_tags = _HTML_TAG_RE.sub("", text)
    no_entities = _HTML_ENTITY_RE.sub(
        lambda m: {"nbsp": " ", "amp": "&", "lt": "<", "gt": ">", "quot": '"', "#39": "'"}[m.group(1)],
        no_tags,
    )
    return no_entities.strip()
