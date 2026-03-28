from domain.dayoff.entities import DayOffRequest


class DayOffMapper:
    @staticmethod
    def to_dynamo(request: DayOffRequest) -> dict:
        item: dict = {
            "PK": f"USER#{request.user_id}",
            "SK": f"DAYOFF#{request.created_at}#{request.request_id}",
            "GSI1PK": f"DAYOFF_ADMIN#{request.admin_id}",
            "GSI1SK": f"DAYOFF#{request.created_at}#{request.request_id}",
            "request_id": request.request_id,
            "user_id": request.user_id,
            "user_name": request.user_name,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "reason": request.reason,
            "status": request.status,
            "team_lead_status": request.team_lead_status,
            "admin_id": request.admin_id,
            "admin_status": request.admin_status,
            "created_at": request.created_at,
            "updated_at": request.updated_at,
        }

        if request.employee_id:
            item["employee_id"] = request.employee_id
        if request.team_lead_id:
            item["team_lead_id"] = request.team_lead_id
            item["GSI2PK"] = f"DAYOFF_LEAD#{request.team_lead_id}"
            item["GSI2SK"] = f"DAYOFF#{request.created_at}#{request.request_id}"
        if request.team_lead_name:
            item["team_lead_name"] = request.team_lead_name
        if request.admin_name:
            item["admin_name"] = request.admin_name
        if request.forwarded_to:
            item["forwarded_to"] = request.forwarded_to
        if request.forwarded_to_name:
            item["forwarded_to_name"] = request.forwarded_to_name
        if request.forwarded_by:
            item["forwarded_by"] = request.forwarded_by

        return item

    @staticmethod
    def to_domain(item: dict) -> DayOffRequest:
        return DayOffRequest(
            request_id=item["request_id"],
            user_id=item["user_id"],
            user_name=item["user_name"],
            employee_id=item.get("employee_id"),
            start_date=item["start_date"],
            end_date=item["end_date"],
            reason=item["reason"],
            status=item.get("status", "PENDING"),
            team_lead_id=item.get("team_lead_id"),
            team_lead_name=item.get("team_lead_name"),
            team_lead_status=item.get("team_lead_status", "N/A"),
            admin_id=item.get("admin_id", ""),
            admin_name=item.get("admin_name"),
            admin_status=item.get("admin_status", "PENDING"),
            forwarded_to=item.get("forwarded_to"),
            forwarded_to_name=item.get("forwarded_to_name"),
            forwarded_by=item.get("forwarded_by"),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )
