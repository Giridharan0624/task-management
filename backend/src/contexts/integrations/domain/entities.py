from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from contexts.integrations.domain.value_objects import (
    AssigneeMode,
    IntegrationStatus,
    ItemType,
)


class Integration(BaseModel):
    """A single connection between a TaskFlow org and a 3rd-party account."""

    integration_id: str
    org_id: str
    provider: str
    display_name: str
    account_id: str
    status: IntegrationStatus = IntegrationStatus.CONNECTED
    encrypted_credentials: bytes
    webhook_secret_hash: str
    assignee_mode: AssigneeMode = AssigneeMode.STRICT
    fallback_assignee_id: Optional[str] = None
    linked_project_id: Optional[str] = None
    last_error: Optional[str] = None
    connected_at: str
    connected_by: str
    updated_at: str

    @classmethod
    def create(
        cls,
        integration_id: str,
        org_id: str,
        provider: str,
        display_name: str,
        account_id: str,
        encrypted_credentials: bytes,
        webhook_secret_hash: str,
        connected_by: str,
        assignee_mode: AssigneeMode = AssigneeMode.STRICT,
        fallback_assignee_id: Optional[str] = None,
        linked_project_id: Optional[str] = None,
    ) -> "Integration":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            integration_id=integration_id,
            org_id=org_id,
            provider=provider,
            display_name=display_name,
            account_id=account_id,
            encrypted_credentials=encrypted_credentials,
            webhook_secret_hash=webhook_secret_hash,
            assignee_mode=assignee_mode,
            fallback_assignee_id=fallback_assignee_id,
            linked_project_id=linked_project_id,
            connected_at=now,
            connected_by=connected_by,
            updated_at=now,
        )


class ExternalLink(BaseModel):
    """Binding between a TaskFlow item and an external item from one provider."""

    org_id: str
    provider: str
    integration_id: str
    item_type: ItemType
    item_id: str
    external_id: str
    external_url: Optional[str] = None
    last_pulled_at: Optional[str] = None
    last_pushed_at: Optional[str] = None
    etag: Optional[str] = None
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        org_id: str,
        provider: str,
        integration_id: str,
        item_type: ItemType,
        item_id: str,
        external_id: str,
        external_url: Optional[str] = None,
    ) -> "ExternalLink":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            org_id=org_id,
            provider=provider,
            integration_id=integration_id,
            item_type=item_type,
            item_id=item_id,
            external_id=external_id,
            external_url=external_url,
            created_at=now,
            updated_at=now,
        )


class SyncEvent(BaseModel):
    """An audit row for an inbound webhook, kept for 30 days."""

    org_id: str
    integration_id: str
    event_id: str
    received_at: str
    raw_headers: dict[str, str]
    raw_body: str
    bearer_verified: bool
    enqueued: bool
    notes: Optional[str] = None


class OutboxEntry(BaseModel):
    """A short-lived sentinel recording an outbound write so a subsequent
    inbound webhook carrying the same sync_id can be dropped (loop guard)."""

    org_id: str
    integration_id: str
    sync_id: str
    item_id: str
    expires_at_epoch: int
