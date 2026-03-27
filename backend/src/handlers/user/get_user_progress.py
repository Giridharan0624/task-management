from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository
from application.user.use_cases import GetUserProgressUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_id = event.get("pathParameters", {}).get("userId", "")
        user_repo = UserDynamoRepository()
        project_repo = ProjectDynamoRepository()
        task_repo = TaskDynamoRepository()
        use_case = GetUserProgressUseCase(user_repo, project_repo, task_repo)
        result = use_case.execute({"user_id": user_id}, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
