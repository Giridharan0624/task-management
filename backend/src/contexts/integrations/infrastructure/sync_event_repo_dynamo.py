from __future__ import annotations

import json
import time
from typing import Optional

from boto3.dynamodb.conditions import Key

from contexts.integrations.domain.entities import SyncEvent
from contexts.integrations.domain.repository import ISyncEventRepository
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id


class SyncEventDynamoRepository(ISyncEventRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def save(self, event: SyncEvent, ttl_days: int = 30) -> None:
        expires_at = int(time.time()) + (ttl_days * 24 * 3600)
        self._table.put_item(
            Item={
                "PK": tenant_keys.org_pk(event.org_id),
                "SK": tenant_keys.integration_event_sk(
                    event.integration_id, event.received_at, event.event_id
                ),
                "org_id": event.org_id,
                "integration_id": event.integration_id,
                "event_id": event.event_id,
                "received_at": event.received_at,
                "raw_headers_json": json.dumps(event.raw_headers, default=str),
                "raw_body": event.raw_body,
                "bearer_verified": event.bearer_verified,
                "enqueued": event.enqueued,
                "notes": event.notes,
                "expires_at": expires_at,
            }
        )

    def list_for_integration(
        self, integration_id: str, limit: int = 50
    ) -> list[SyncEvent]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(self._org_id))
            & Key("SK").begins_with(f"INTEGRATION#{integration_id}#EVENT#"),
            ScanIndexForward=False,
            Limit=limit,
        )
        out: list[SyncEvent] = []
        for item in response.get("Items", []):
            out.append(
                SyncEvent(
                    org_id=item["org_id"],
                    integration_id=item["integration_id"],
                    event_id=item["event_id"],
                    received_at=item["received_at"],
                    raw_headers=json.loads(item.get("raw_headers_json", "{}")),
                    raw_body=item.get("raw_body", ""),
                    bearer_verified=bool(item.get("bearer_verified", False)),
                    enqueued=bool(item.get("enqueued", False)),
                    notes=item.get("notes"),
                )
            )
        return out
