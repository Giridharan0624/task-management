from typing import Optional

from boto3.dynamodb.conditions import Attr, Key

from contexts.dayoff.domain.entities import DayOffRequest
from contexts.dayoff.domain.repository import IDayOffRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id
from shared_kernel import tenant_keys
from contexts.dayoff.infrastructure.mapper import DayOffMapper


class DayOffDynamoRepository(IDayOffRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def save(self, request: DayOffRequest) -> None:
        self._table.put_item(Item=DayOffMapper.to_dynamo(request))
        self._table.put_item(Item=DayOffMapper.to_dynamo_v2(request, self._org_id))

    def find_by_id(self, request_id: str) -> Optional[DayOffRequest]:
        # Scoped scan — look only inside this tenant's user namespace.
        org_prefix = f"ORG#{self._org_id}#USER#"
        response = self._table.scan(
            FilterExpression=Attr("request_id").eq(request_id)
            & Attr("SK").begins_with("DAYOFF#")
            & Attr("PK").begins_with(org_prefix),
        )
        items = response.get("Items", [])
        while not items and "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("request_id").eq(request_id)
                & Attr("SK").begins_with("DAYOFF#")
                & Attr("PK").begins_with(org_prefix),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items = response.get("Items", [])
        if not items:
            return None
        return DayOffMapper.to_domain(items[0])

    def find_by_user(self, user_id: str) -> list[DayOffRequest]:
        user_pk = tenant_keys.user_pk(self._org_id, user_id)
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(user_pk)
            & Key("SK").begins_with("DAYOFF#"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(user_pk)
                & Key("SK").begins_with("DAYOFF#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [DayOffMapper.to_domain(item) for item in items]

    def find_by_approver(self, approver_id: str) -> list[DayOffRequest]:
        org_prefix = f"ORG#{self._org_id}#USER#"
        filter_expr = (
            Attr("SK").begins_with("DAYOFF#")
            & Attr("PK").begins_with(org_prefix)
            & (
                Attr("admin_id").eq(approver_id)
                | Attr("team_lead_id").eq(approver_id)
                | Attr("forwarded_to").eq(approver_id)
            )
        )
        response = self._table.scan(FilterExpression=filter_expr)
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=filter_expr,
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [DayOffMapper.to_domain(item) for item in items]

    def find_all(self) -> list[DayOffRequest]:
        org_prefix = f"ORG#{self._org_id}#USER#"
        response = self._table.scan(
            FilterExpression=Attr("SK").begins_with("DAYOFF#")
            & Attr("PK").begins_with(org_prefix),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").begins_with("DAYOFF#")
                & Attr("PK").begins_with(org_prefix),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [DayOffMapper.to_domain(item) for item in items]
