from pydantic import BaseModel

from application.comment.use_cases import CreateCommentUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.comment_repository import CommentDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


class CreateCommentRequest(BaseModel):
    message: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        task_id = path_params.get("taskId", "")
        body = validate_body(CreateCommentRequest, event.get("body"))
        dto = {"task_id": task_id, "message": body.message}
        comment_repo = CommentDynamoRepository()
        task_repo = TaskDynamoRepository()
        use_case = CreateCommentUseCase(comment_repo, task_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
