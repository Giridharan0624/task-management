from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel

from contexts.integrations.domain.value_objects import ChangeType, ItemType


class NormalizedItem(BaseModel):
    """Provider-agnostic representation of an external item (e.g. a Freshdesk
    ticket, a Slack message). Connectors translate native payloads into this."""

    external_id: str
    external_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_email: Optional[str] = None
    due_at: Optional[str] = None
    tags: list[str] = []
    updated_at: Optional[str] = None
    metadata: dict[str, Any] = {}


class NormalizedEvent(BaseModel):
    """What a connector emits after parsing a raw webhook payload. The platform
    enqueues this, then the sync_worker reconciles it against the REST API."""

    provider: str
    integration_id: str
    external_id: str
    item_type: ItemType = ItemType.TASK
    change_type: ChangeType
    received_at: str
    raw_metadata: dict[str, Any] = {}


class ItemPatch(BaseModel):
    """The diff a connector should apply to an external item when pushing
    outbound. Connectors are free to ignore fields they don't support."""

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_email: Optional[str] = None
    due_at: Optional[str] = None
    tags: Optional[list[str]] = None
    sync_id: Optional[str] = None
