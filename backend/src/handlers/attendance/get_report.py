from application.attendance.use_cases import GetAttendanceReportUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository
from shared.errors import ValidationError


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        params = event.get("queryStringParameters") or {}
        start_date = params.get("startDate") or params.get("start_date")
        end_date = params.get("endDate") or params.get("end_date")

        if not start_date or not end_date:
            raise ValidationError("startDate and endDate query parameters are required")

        attendance_repo = AttendanceDynamoRepository()
        use_case = GetAttendanceReportUseCase(attendance_repo)
        result = use_case.execute(auth.user_id, auth.system_role, start_date, end_date)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
