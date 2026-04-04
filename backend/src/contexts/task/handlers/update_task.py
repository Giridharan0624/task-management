from typing import Optional

from pydantic import BaseModel

from contexts.task.application.use_cases import UpdateTaskUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    domain: Optional[str] = None
    assigned_to: Optional[list[str]] = None
    deadline: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        task_id = path_params.get("taskId", "")
        body = validate_body(UpdateTaskRequest, event.get("body"))
        dto = body.model_dump(exclude_none=True)
        dto["project_id"] = project_id
        dto["task_id"] = task_id
        task_repo = TaskDynamoRepository()
        project_repo = ProjectDynamoRepository()
        use_case = UpdateTaskUseCase(task_repo, project_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
