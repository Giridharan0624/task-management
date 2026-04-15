from boto3.dynamodb.conditions import Key

from contexts.taskupdate.domain.entities import TaskUpdate
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import DEFAULT_ORG_ID
from contexts.taskupdate.infrastructure.mapper import TaskUpdateMapper


class TaskUpdateDynamoRepository:
    def __init__(self, org_id: str = DEFAULT_ORG_ID):
        self._table = get_table()
        self._org_id = org_id

    def save(self, update: TaskUpdate) -> None:
        self._table.put_item(Item=TaskUpdateMapper.to_dynamo(update))
        self._table.put_item(Item=TaskUpdateMapper.to_dynamo_v2(update, self._org_id))

    def find_by_date(self, date: str) -> list[TaskUpdate]:
        """Get all task updates for a given date (for owner/admin view)."""
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"TASKUPDATE#{date}")
        )
        items = response.get("Items", [])
        return [TaskUpdateMapper.to_domain(item) for item in items]

    def find_by_user_and_date(self, user_id: str, date: str) -> TaskUpdate | None:
        """Check if user already submitted an update for today."""
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"USER#{user_id}")
            & Key("GSI1SK").eq(f"TASKUPDATE#{date}"),
        )
        items = response.get("Items", [])
        if not items:
            return None
        return TaskUpdateMapper.to_domain(items[0])

    def find_recent(self, limit: int = 50) -> list[TaskUpdate]:
        """Scan recent task updates (for the overview page)."""
        response = self._table.scan(
            FilterExpression=Key("PK").begins_with("TASKUPDATE#"),
            Limit=limit * 3,  # overscan to account for non-matching items
        )
        items = [i for i in response.get("Items", []) if i["PK"].startswith("TASKUPDATE#")]
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        updates = [TaskUpdateMapper.to_domain(item) for item in items[:limit]]
        return updates
