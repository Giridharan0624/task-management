from typing import Optional
from decimal import Decimal

from boto3.dynamodb.conditions import Key

from domain.attendance.entities import Attendance
from domain.attendance.repository import IAttendanceRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.attendance_mapper import AttendanceMapper


class AttendanceDynamoRepository(IAttendanceRepository):
    def __init__(self):
        self._table = get_table()

    def find_by_user_and_date(self, user_id: str, date: str) -> Optional[Attendance]:
        response = self._table.get_item(
            Key={"PK": f"USER#{user_id}", "SK": f"ATTENDANCE#{date}"}
        )
        item = response.get("Item")
        if not item:
            return None
        # Convert Decimal total_hours back to float
        if "total_hours" in item and item["total_hours"] is not None:
            item["total_hours"] = float(item["total_hours"])
        return AttendanceMapper.to_domain(item)

    def save(self, attendance: Attendance) -> None:
        item = AttendanceMapper.to_dynamo(attendance)
        # DynamoDB requires Decimal for numbers
        if "total_hours" in item and item["total_hours"] is not None:
            item["total_hours"] = Decimal(item["total_hours"])
        self._table.put_item(Item=item)

    def find_all_by_date(self, date: str) -> list[Attendance]:
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"ATTENDANCE_DATE#{date}"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.query(
                IndexName="GSI1",
                KeyConditionExpression=Key("GSI1PK").eq(f"ATTENDANCE_DATE#{date}"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        result = []
        for item in items:
            if "total_hours" in item and item["total_hours"] is not None:
                item["total_hours"] = float(item["total_hours"])
            result.append(AttendanceMapper.to_domain(item))
        return result
