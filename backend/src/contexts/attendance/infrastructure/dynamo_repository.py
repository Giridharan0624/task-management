from typing import Optional
from decimal import Decimal

from boto3.dynamodb.conditions import Attr, Key

from contexts.attendance.domain.entities import Attendance
from contexts.attendance.domain.repository import IAttendanceRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import DEFAULT_ORG_ID
from contexts.attendance.infrastructure.mapper import AttendanceMapper


class AttendanceDynamoRepository(IAttendanceRepository):
    def __init__(self, org_id: str = DEFAULT_ORG_ID):
        self._table = get_table()
        self._org_id = org_id

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
        legacy = AttendanceMapper.to_dynamo(attendance)
        if "total_hours" in legacy and legacy["total_hours"] is not None:
            legacy["total_hours"] = Decimal(legacy["total_hours"])
        self._table.put_item(Item=legacy)

        v2 = AttendanceMapper.to_dynamo_v2(attendance, self._org_id)
        if "total_hours" in v2 and v2["total_hours"] is not None:
            v2["total_hours"] = Decimal(v2["total_hours"])
        self._table.put_item(Item=v2)

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

    def find_all_by_date_range(self, start_date: str, end_date: str) -> list[Attendance]:
        """Scan for all attendance records within a date range (inclusive)."""
        response = self._table.scan(
            FilterExpression=Attr("SK").begins_with("ATTENDANCE#")
            & Attr("date").between(start_date, end_date),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").begins_with("ATTENDANCE#")
                & Attr("date").between(start_date, end_date),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        result = []
        for item in items:
            if "total_hours" in item and item["total_hours"] is not None:
                item["total_hours"] = float(item["total_hours"])
            result.append(AttendanceMapper.to_domain(item))
        result.sort(key=lambda a: (a.date, a.user_name))
        return result
