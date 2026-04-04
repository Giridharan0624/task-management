from contexts.attendance.application.use_cases import SignOutUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.attendance.infrastructure.dynamo_repository import AttendanceDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        attendance_repo = AttendanceDynamoRepository()
        use_case = SignOutUseCase(attendance_repo)
        result = use_case.execute(auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
