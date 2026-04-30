from __future__ import annotations

import base64
from typing import Optional

from boto3.dynamodb.conditions import Key

from contexts.integrations.domain.entities import Integration
from contexts.integrations.domain.repository import IIntegrationRepository
from contexts.integrations.domain.value_objects import (
    AssigneeMode,
    IntegrationStatus,
)
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id


class IntegrationDynamoRepository(IIntegrationRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def save(self, integration: Integration) -> None:
        self._table.put_item(Item=self._to_dynamo(integration))

    def update(self, integration: Integration) -> None:
        self._table.put_item(Item=self._to_dynamo(integration))

    def find_by_id(self, integration_id: str) -> Optional[Integration]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(self._org_id))
            & Key("SK").begins_with("INTEGRATION#"),
        )
        for item in response.get("Items", []):
            sk: str = item.get("SK", "")
            if sk.startswith("INTEGRATION#") and sk.endswith(f"#{integration_id}"):
                if "#EVENT#" in sk or "#OUTBOX#" in sk:
                    continue
                return self._to_domain(item)
        return None

    def list_for_org(self, org_id: str) -> list[Integration]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(org_id))
            & Key("SK").begins_with("INTEGRATION#"),
        )
        out: list[Integration] = []
        for item in response.get("Items", []):
            sk: str = item.get("SK", "")
            if "#EVENT#" in sk or "#OUTBOX#" in sk:
                continue
            out.append(self._to_domain(item))
        return out

    def count_active_for_org(self, org_id: str) -> int:
        return sum(
            1
            for i in self.list_for_org(org_id)
            if i.status
            in (IntegrationStatus.CONNECTED, IntegrationStatus.NEEDS_REAUTH, IntegrationStatus.PAUSED)
        )

    def delete(self, integration_id: str) -> None:
        existing = self.find_by_id(integration_id)
        if existing is None:
            return
        self._table.delete_item(
            Key={
                "PK": tenant_keys.org_pk(self._org_id),
                "SK": tenant_keys.integration_sk(existing.provider, integration_id),
            }
        )

    def _to_dynamo(self, integration: Integration) -> dict:
        return {
            "PK": tenant_keys.org_pk(integration.org_id),
            "SK": tenant_keys.integration_sk(integration.provider, integration.integration_id),
            "integration_id": integration.integration_id,
            "org_id": integration.org_id,
            "provider": integration.provider,
            "display_name": integration.display_name,
            "account_id": integration.account_id,
            "status": integration.status.value,
            "encrypted_credentials_b64": base64.b64encode(integration.encrypted_credentials).decode("ascii"),
            "webhook_secret_hash": integration.webhook_secret_hash,
            "assignee_mode": integration.assignee_mode.value,
            "fallback_assignee_id": integration.fallback_assignee_id,
            "linked_project_id": integration.linked_project_id,
            "last_error": integration.last_error,
            "connected_at": integration.connected_at,
            "connected_by": integration.connected_by,
            "updated_at": integration.updated_at,
        }

    def _to_domain(self, item: dict) -> Integration:
        return Integration(
            integration_id=item["integration_id"],
            org_id=item["org_id"],
            provider=item["provider"],
            display_name=item["display_name"],
            account_id=item["account_id"],
            status=IntegrationStatus(item.get("status", IntegrationStatus.CONNECTED.value)),
            encrypted_credentials=base64.b64decode(item["encrypted_credentials_b64"]),
            webhook_secret_hash=item["webhook_secret_hash"],
            assignee_mode=AssigneeMode(item.get("assignee_mode", AssigneeMode.STRICT.value)),
            fallback_assignee_id=item.get("fallback_assignee_id"),
            linked_project_id=item.get("linked_project_id"),
            last_error=item.get("last_error"),
            connected_at=item["connected_at"],
            connected_by=item["connected_by"],
            updated_at=item["updated_at"],
        )
