from typing import Optional
from decimal import Decimal

from boto3.dynamodb.conditions import Attr, Key

from contexts.attendance.domain.entities import Attendance
from contexts.attendance.domain.repository import IAttendanceRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id
from shared_kernel import tenant_keys
from contexts.attendance.infrastructure.mapper import AttendanceMapper


class AttendanceDynamoRepository(IAttendanceRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def find_by_user_and_date(self, user_id: str, date: str) -> Optional[Attendance]:
        response = self._table.get_item(
            Key={
                "PK": tenant_keys.user_pk(self._org_id, user_id),
                "SK": tenant_keys.attendance_sk(date),
            }
        )
        item = response.get("Item")
        if not item:
            return None
        # Convert Decimal total_hours back to float
        if "total_hours" in item and item["total_hours"] is not None:
            item["total_hours"] = float(item["total_hours"])
        return AttendanceMapper.to_domain(item)

    def save(self, attendance: Attendance) -> None:
        item = AttendanceMapper.to_dynamo(attendance, self._org_id)
        if "total_hours" in item and item["total_hours"] is not None:
            item["total_hours"] = Decimal(item["total_hours"])
        self._table.put_item(Item=item)

    def find_all_by_date(self, date: str) -> list[Attendance]:
        gsi_pk = tenant_keys.attendance_date_gsi1pk(self._org_id, date)
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
        result = []
        for item in items:
            if "total_hours" in item and item["total_hours"] is not None:
                item["total_hours"] = float(item["total_hours"])
            result.append(AttendanceMapper.to_domain(item))
        return result

    def find_all_by_date_range(self, start_date: str, end_date: str) -> list[Attendance]:
        """Scan for all attendance records within a date range (inclusive),
        scoped to the current tenant."""
        org_prefix = f"ORG#{self._org_id}#USER#"
        response = self._table.scan(
            FilterExpression=Attr("SK").begins_with("ATTENDANCE#")
            & Attr("PK").begins_with(org_prefix)
            & Attr("date").between(start_date, end_date),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").begins_with("ATTENDANCE#")
                & Attr("PK").begins_with(org_prefix)
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
