from contexts.comment.application.use_cases import ListCommentsUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.comment.infrastructure.dynamo_repository import CommentDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        task_id = path_params.get("taskId", "")
        dto = {"task_id": task_id, "project_id": project_id}
        comment_repo = CommentDynamoRepository()
        task_repo = TaskDynamoRepository()
        project_repo = ProjectDynamoRepository()
        use_case = ListCommentsUseCase(comment_repo, task_repo, project_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
