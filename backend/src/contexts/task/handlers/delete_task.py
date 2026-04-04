from contexts.task.application.use_cases import DeleteTaskUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.comment.infrastructure.dynamo_repository import CommentDynamoRepository
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        task_id = path_params.get("taskId", "")
        task_repo = TaskDynamoRepository()
        project_repo = ProjectDynamoRepository()
        comment_repo = CommentDynamoRepository()
        use_case = DeleteTaskUseCase(task_repo, project_repo, comment_repo)
        use_case.execute({"project_id": project_id, "task_id": task_id}, auth.user_id, auth.system_role)
        return build_success(204, {})
    except Exception as e:
        return build_error(e)
