import json

from application.attendance.use_cases import SignInUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        body = {}
        raw_body = event.get("body")
        if raw_body:
            body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        attendance_repo = AttendanceDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = SignInUseCase(attendance_repo, user_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            caller_system_role=auth.system_role,
            task_id=body.get("task_id"),
            project_id=body.get("project_id"),
            task_title=body.get("task_title"),
            project_name=body.get("project_name"),
        )
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
