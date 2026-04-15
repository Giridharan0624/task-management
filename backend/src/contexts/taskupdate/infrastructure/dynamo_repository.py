from typing import Optional

from boto3.dynamodb.conditions import Attr, Key

from contexts.taskupdate.domain.entities import TaskUpdate
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id
from shared_kernel import tenant_keys
from contexts.taskupdate.infrastructure.mapper import TaskUpdateMapper


class TaskUpdateDynamoRepository:
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def save(self, update: TaskUpdate) -> None:
        self._table.put_item(Item=TaskUpdateMapper.to_dynamo(update))
        self._table.put_item(Item=TaskUpdateMapper.to_dynamo_v2(update, self._org_id))

    def find_by_date(self, date: str) -> list[TaskUpdate]:
        """Get all task updates for a given date (for owner/admin view)."""
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(
                tenant_keys.taskupdate_pk(self._org_id, date)
            )
        )
        items = response.get("Items", [])
        return [TaskUpdateMapper.to_domain(item) for item in items]

    def find_by_user_and_date(self, user_id: str, date: str) -> TaskUpdate | None:
        """Check if user already submitted an update for today."""
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(
                tenant_keys.taskupdate_user_gsi1pk(self._org_id, user_id)
            )
            & Key("GSI1SK").eq(f"TASKUPDATE#{date}"),
        )
        items = response.get("Items", [])
        if not items:
            return None
        return TaskUpdateMapper.to_domain(items[0])

    def find_recent(self, limit: int = 50) -> list[TaskUpdate]:
        """Scan recent task updates (for the overview page), scoped to
        the current tenant."""
        org_prefix = f"ORG#{self._org_id}#TASKUPDATE#"
        response = self._table.scan(
            FilterExpression=Attr("PK").begins_with(org_prefix),
            Limit=limit * 3,  # overscan to account for non-matching items
        )
        items = [
            i for i in response.get("Items", [])
            if i["PK"].startswith(org_prefix)
        ]
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        updates = [TaskUpdateMapper.to_domain(item) for item in items[:limit]]
        return updates
