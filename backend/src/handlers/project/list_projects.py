from application.project.use_cases import ListProjectsForUserUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        task_repo = TaskDynamoRepository()
        use_case = ListProjectsForUserUseCase(project_repo, user_repo, task_repo)
        result = use_case.execute({}, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
