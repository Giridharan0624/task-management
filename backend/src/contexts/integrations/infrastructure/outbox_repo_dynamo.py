from __future__ import annotations

import time
from typing import Optional

from contexts.integrations.domain.entities import OutboxEntry
from contexts.integrations.domain.repository import IOutboxRepository
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id


class OutboxDynamoRepository(IOutboxRepository):
    """Echo-guard sentinels. Written immediately before an outbound push;
    looked up on every inbound webhook. TTL keeps the table small."""

    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def put(self, entry: OutboxEntry, ttl_seconds: int = 300) -> None:
        expires = entry.expires_at_epoch or (int(time.time()) + ttl_seconds)
        self._table.put_item(
            Item={
                "PK": tenant_keys.org_pk(entry.org_id),
                "SK": tenant_keys.integration_outbox_sk(
                    entry.integration_id, entry.sync_id
                ),
                "org_id": entry.org_id,
                "integration_id": entry.integration_id,
                "sync_id": entry.sync_id,
                "item_id": entry.item_id,
                "expires_at": expires,
            }
        )

    def find(self, integration_id: str, sync_id: str) -> Optional[OutboxEntry]:
        response = self._table.get_item(
            Key={
                "PK": tenant_keys.org_pk(self._org_id),
                "SK": tenant_keys.integration_outbox_sk(integration_id, sync_id),
            }
        )
        item = response.get("Item")
        if not item:
            return None
        if int(item.get("expires_at", 0)) < int(time.time()):
            return None
        return OutboxEntry(
            org_id=item["org_id"],
            integration_id=item["integration_id"],
            sync_id=item["sync_id"],
            item_id=item["item_id"],
            expires_at_epoch=int(item["expires_at"]),
        )
