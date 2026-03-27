from application.attendance.use_cases import SignInUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        attendance_repo = AttendanceDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = SignInUseCase(attendance_repo, user_repo)
        result = use_case.execute(auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
