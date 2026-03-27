from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository
from application.task.use_cases import GetMyAssignedTasksUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        project_repo = ProjectDynamoRepository()
        task_repo = TaskDynamoRepository()
        use_case = GetMyAssignedTasksUseCase(task_repo, project_repo)
        my_tasks = use_case.execute(auth.user_id)
        return build_success(200, my_tasks)
    except Exception as e:
        return build_error(e)
