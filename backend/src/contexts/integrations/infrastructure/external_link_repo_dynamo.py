from __future__ import annotations

from typing import Optional

from boto3.dynamodb.conditions import Key

from contexts.integrations.domain.entities import ExternalLink
from contexts.integrations.domain.repository import IExternalLinkRepository
from contexts.integrations.domain.value_objects import ItemType
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id


class ExternalLinkDynamoRepository(IExternalLinkRepository):
    """Two rows per binding: a forward row keyed by external_id (used by inbound
    webhooks) and a reverse row keyed by item_id (used by outbound emitter).
    Both stay in sync via dual-write."""

    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def save(self, link: ExternalLink) -> None:
        self._write_pair(link)

    def update(self, link: ExternalLink) -> None:
        self._write_pair(link)

    def _write_pair(self, link: ExternalLink) -> None:
        forward = {
            "PK": tenant_keys.org_pk(link.org_id),
            "SK": tenant_keys.extlink_external_sk(link.provider, link.external_id),
            **self._common(link),
        }
        reverse = {
            "PK": tenant_keys.org_pk(link.org_id),
            "SK": tenant_keys.extlink_item_sk(
                link.item_type.value, link.item_id, link.provider
            ),
            **self._common(link),
        }
        self._table.put_item(Item=forward)
        self._table.put_item(Item=reverse)

    def find_by_external(
        self, provider: str, external_id: str
    ) -> Optional[ExternalLink]:
        response = self._table.get_item(
            Key={
                "PK": tenant_keys.org_pk(self._org_id),
                "SK": tenant_keys.extlink_external_sk(provider, external_id),
            }
        )
        item = response.get("Item")
        if not item:
            return None
        return self._to_domain(item)

    def find_by_item(
        self, item_type: ItemType, item_id: str
    ) -> list[ExternalLink]:
        prefix = f"EXTLINK#ITEM#{item_type.value}#{item_id}#"
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(self._org_id))
            & Key("SK").begins_with(prefix),
        )
        return [self._to_domain(i) for i in response.get("Items", [])]

    def delete(self, provider: str, external_id: str) -> None:
        existing = self.find_by_external(provider, external_id)
        if existing is None:
            return
        org_pk = tenant_keys.org_pk(self._org_id)
        self._table.delete_item(
            Key={"PK": org_pk, "SK": tenant_keys.extlink_external_sk(provider, external_id)}
        )
        self._table.delete_item(
            Key={
                "PK": org_pk,
                "SK": tenant_keys.extlink_item_sk(
                    existing.item_type.value, existing.item_id, provider
                ),
            }
        )

    def _common(self, link: ExternalLink) -> dict:
        return {
            "org_id": link.org_id,
            "provider": link.provider,
            "integration_id": link.integration_id,
            "item_type": link.item_type.value,
            "item_id": link.item_id,
            "external_id": link.external_id,
            "external_url": link.external_url,
            "last_pulled_at": link.last_pulled_at,
            "last_pushed_at": link.last_pushed_at,
            "etag": link.etag,
            "created_at": link.created_at,
            "updated_at": link.updated_at,
        }

    def _to_domain(self, item: dict) -> ExternalLink:
        return ExternalLink(
            org_id=item["org_id"],
            provider=item["provider"],
            integration_id=item["integration_id"],
            item_type=ItemType(item["item_type"]),
            item_id=item["item_id"],
            external_id=item["external_id"],
            external_url=item.get("external_url"),
            last_pulled_at=item.get("last_pulled_at"),
            last_pushed_at=item.get("last_pushed_at"),
            etag=item.get("etag"),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )
