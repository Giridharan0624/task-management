from boto3.dynamodb.conditions import Key

from domain.taskupdate.entities import TaskUpdate
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.taskupdate_mapper import TaskUpdateMapper


class TaskUpdateDynamoRepository:
    def __init__(self):
        self._table = get_table()

    def save(self, update: TaskUpdate) -> None:
        item = TaskUpdateMapper.to_dynamo(update)
        self._table.put_item(Item=item)

    def find_by_date(self, date: str) -> list[TaskUpdate]:
        """Get all task updates for a given date (for owner/CEO/MD view)."""
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
