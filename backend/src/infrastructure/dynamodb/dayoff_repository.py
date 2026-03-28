from typing import Optional

from boto3.dynamodb.conditions import Attr, Key

from domain.dayoff.entities import DayOffRequest
from domain.dayoff.repository import IDayOffRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.dayoff_mapper import DayOffMapper


class DayOffDynamoRepository(IDayOffRepository):
    def __init__(self):
        self._table = get_table()

    def save(self, request: DayOffRequest) -> None:
        item = DayOffMapper.to_dynamo(request)
        self._table.put_item(Item=item)

    def find_by_id(self, request_id: str) -> Optional[DayOffRequest]:
        response = self._table.scan(
            FilterExpression=Attr("request_id").eq(request_id)
            & Attr("SK").begins_with("DAYOFF#"),
        )
        items = response.get("Items", [])
        while not items and "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("request_id").eq(request_id)
                & Attr("SK").begins_with("DAYOFF#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items = response.get("Items", [])
        if not items:
            return None
        return DayOffMapper.to_domain(items[0])

    def find_by_user(self, user_id: str) -> list[DayOffRequest]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}")
            & Key("SK").begins_with("DAYOFF#"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"USER#{user_id}")
                & Key("SK").begins_with("DAYOFF#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [DayOffMapper.to_domain(item) for item in items]

    def find_by_approver(self, approver_id: str) -> list[DayOffRequest]:
        response = self._table.scan(
            FilterExpression=(
                Attr("SK").begins_with("DAYOFF#")
                & (
                    Attr("admin_id").eq(approver_id)
                    | Attr("team_lead_id").eq(approver_id)
                    | Attr("forwarded_to").eq(approver_id)
                )
            ),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=(
                    Attr("SK").begins_with("DAYOFF#")
                    & (
                        Attr("admin_id").eq(approver_id)
                        | Attr("team_lead_id").eq(approver_id)
                        | Attr("forwarded_to").eq(approver_id)
                    )
                ),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [DayOffMapper.to_domain(item) for item in items]

    def find_all(self) -> list[DayOffRequest]:
        response = self._table.scan(
            FilterExpression=Attr("SK").begins_with("DAYOFF#"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").begins_with("DAYOFF#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [DayOffMapper.to_domain(item) for item in items]
