from pydantic import BaseModel

from contexts.comment.application.use_cases import CreateCommentUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_feature, require_not_suspended
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.comment.infrastructure.dynamo_repository import CommentDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository


class CreateCommentRequest(BaseModel):
    message: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # Backend half of the FeatureGate UI pattern. When OWNER turns
        # comments off in /settings/organization → Features, the UI
        # hides the comment box, but a stale cached page or a direct
        # API call could still POST here. Reject with 403 so the
        # disable actually disables. Reads (list_comments) stay open
        # so existing comments remain visible — toggling off doesn't
        # destroy history.
        require_feature(auth, "comments")
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
