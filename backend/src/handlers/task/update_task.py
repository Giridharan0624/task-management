from typing import Optional

from pydantic import BaseModel

from application.task.use_cases import UpdateTaskUseCase
from domain.task.value_objects import TaskPriority, TaskStatus
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        task_id = path_params.get("taskId", "")
        body = validate_body(UpdateTaskRequest, event.get("body"))
        dto = body.model_dump(exclude_none=True)
        dto["board_id"] = board_id
        dto["task_id"] = task_id
        # Convert enums to values for the use case
        if dto.get("status"):
            dto["status"] = dto["status"].value if hasattr(dto["status"], "value") else dto["status"]
        if dto.get("priority"):
            dto["priority"] = dto["priority"].value if hasattr(dto["priority"], "value") else dto["priority"]
        task_repo = TaskDynamoRepository()
        board_repo = BoardDynamoRepository()
        use_case = UpdateTaskUseCase(task_repo, board_repo)
        result = use_case.execute(dto, auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
