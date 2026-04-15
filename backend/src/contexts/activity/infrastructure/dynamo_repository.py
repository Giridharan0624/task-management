from typing import Optional
from boto3.dynamodb.conditions import Key, Attr

from contexts.activity.domain.entities import UserActivity, DailySummary
from contexts.activity.domain.repository import IActivityRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id
from shared_kernel import tenant_keys
from contexts.activity.infrastructure.mapper import ActivityMapper


class ActivityDynamoRepository(IActivityRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def find_by_user_and_date(self, user_id: str, date: str) -> Optional[UserActivity]:
        response = self._table.get_item(
            Key={
                "PK": tenant_keys.user_pk(self._org_id, user_id),
                "SK": tenant_keys.activity_sk(date),
            }
        )
        item = response.get("Item")
        if not item:
            return None
        return ActivityMapper.to_domain(item)

    def save(self, activity: UserActivity) -> None:
        self._table.put_item(Item=ActivityMapper.to_dynamo(activity, self._org_id))

    def find_all_by_date(self, date: str) -> list[UserActivity]:
        gsi_pk = tenant_keys.activity_date_gsi1pk(self._org_id, date)
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(gsi_pk),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.query(
                IndexName="GSI1",
                KeyConditionExpression=Key("GSI1PK").eq(gsi_pk),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [ActivityMapper.to_domain(item) for item in items]

    def find_all_by_date_range(self, start_date: str, end_date: str) -> list[UserActivity]:
        org_prefix = f"ORG#{self._org_id}#USER#"
        response = self._table.scan(
            FilterExpression=Attr("SK").begins_with("ACTIVITY#")
            & Attr("PK").begins_with(org_prefix)
            & Attr("date").between(start_date, end_date),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").begins_with("ACTIVITY#")
                & Attr("PK").begins_with(org_prefix)
                & Attr("date").between(start_date, end_date),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        result = [ActivityMapper.to_domain(item) for item in items]
        result.sort(key=lambda a: (a.date, a.user_name))
        return result

    def save_summary(self, summary: DailySummary) -> None:
        self._table.put_item(Item=ActivityMapper.summary_to_dynamo(summary, self._org_id))

    def find_summary(self, user_id: str, date: str) -> Optional[DailySummary]:
        response = self._table.get_item(
            Key={
                "PK": tenant_keys.user_pk(self._org_id, user_id),
                "SK": tenant_keys.activity_summary_sk(date),
            }
        )
        item = response.get("Item")
        if not item:
            return None
        return ActivityMapper.summary_to_domain(item)
