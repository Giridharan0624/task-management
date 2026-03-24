from pydantic import BaseModel

from application.task.use_cases import AssignTaskUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


class AssignTaskRequest(BaseModel):
    assigned_to: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        task_id = path_params.get("taskId", "")
        body = validate_body(AssignTaskRequest, event.get("body"))
        dto = body.model_dump()
        dto["board_id"] = board_id
        dto["task_id"] = task_id
        task_repo = TaskDynamoRepository()
        board_repo = BoardDynamoRepository()
        use_case = AssignTaskUseCase(task_repo, board_repo)
        result = use_case.execute(dto, auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
