from contexts.project.application.use_cases import ListProjectsForUserUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository


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
