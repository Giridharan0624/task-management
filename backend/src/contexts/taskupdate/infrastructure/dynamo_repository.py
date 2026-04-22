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
        self._table.put_item(Item=TaskUpdateMapper.to_dynamo(update, self._org_id))

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

    def find_by_date_range(self, start_date: str, end_date: str) -> list[TaskUpdate]:
        """Return every task update the tenant submitted within the inclusive
        [start_date, end_date] window (YYYY-MM-DD strings).

        The partition layout is one PK per (org, date), so we issue one Query
        per day and concatenate. For a 7-day window that's 7 cheap queries —
        well under a Scan's cost and bounded by tenant size.
        """
        from datetime import date as date_cls, timedelta

        start = date_cls.fromisoformat(start_date)
        end = date_cls.fromisoformat(end_date)
        if end < start:
            return []

        updates: list[TaskUpdate] = []
        current = start
        while current <= end:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(
                    tenant_keys.taskupdate_pk(self._org_id, current.isoformat())
                )
            )
            for item in response.get("Items", []):
                updates.append(TaskUpdateMapper.to_domain(item))
            current += timedelta(days=1)
        return updates

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
