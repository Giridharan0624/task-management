from application.attendance.use_cases import GetMyAttendanceUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        attendance_repo = AttendanceDynamoRepository()
        use_case = GetMyAttendanceUseCase(attendance_repo)
        result = use_case.execute(auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
