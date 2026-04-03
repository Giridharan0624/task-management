from typing import Optional
from boto3.dynamodb.conditions import Key, Attr

from domain.activity.entities import UserActivity, DailySummary
from domain.activity.repository import IActivityRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.activity_mapper import ActivityMapper


class ActivityDynamoRepository(IActivityRepository):
    def __init__(self):
        self._table = get_table()

    def find_by_user_and_date(self, user_id: str, date: str) -> Optional[UserActivity]:
        response = self._table.get_item(
            Key={"PK": f"USER#{user_id}", "SK": f"ACTIVITY#{date}"}
        )
        item = response.get("Item")
        if not item:
            return None
        return ActivityMapper.to_domain(item)

    def save(self, activity: UserActivity) -> None:
        item = ActivityMapper.to_dynamo(activity)
        self._table.put_item(Item=item)

    def find_all_by_date(self, date: str) -> list[UserActivity]:
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"ACTIVITY_DATE#{date}"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.query(
                IndexName="GSI1",
                KeyConditionExpression=Key("GSI1PK").eq(f"ACTIVITY_DATE#{date}"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [ActivityMapper.to_domain(item) for item in items]

    def find_all_by_date_range(self, start_date: str, end_date: str) -> list[UserActivity]:
        response = self._table.scan(
            FilterExpression=Attr("SK").begins_with("ACTIVITY#")
            & Attr("date").between(start_date, end_date),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").begins_with("ACTIVITY#")
                & Attr("date").between(start_date, end_date),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        result = [ActivityMapper.to_domain(item) for item in items]
        result.sort(key=lambda a: (a.date, a.user_name))
        return result

    def save_summary(self, summary: DailySummary) -> None:
        item = ActivityMapper.summary_to_dynamo(summary)
        self._table.put_item(Item=item)

    def find_summary(self, user_id: str, date: str) -> Optional[DailySummary]:
        response = self._table.get_item(
            Key={"PK": f"USER#{user_id}", "SK": f"SUMMARY#{date}"}
        )
        item = response.get("Item")
        if not item:
            return None
        return ActivityMapper.summary_to_domain(item)
