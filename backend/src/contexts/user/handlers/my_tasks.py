from shared_kernel.response import build_success, build_error
from shared_kernel.auth_context import extract_auth_context
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.task.application.use_cases import GetMyAssignedTasksUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        project_repo = ProjectDynamoRepository()
        task_repo = TaskDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = GetMyAssignedTasksUseCase(task_repo, project_repo, user_repo)
        my_tasks = use_case.execute(auth.user_id, auth.system_role)
        return build_success(200, my_tasks)
    except Exception as e:
        return build_error(e)
