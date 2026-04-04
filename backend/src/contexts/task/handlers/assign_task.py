from pydantic import BaseModel

from contexts.task.application.use_cases import AssignTaskUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository


class AssignTaskRequest(BaseModel):
    assigned_to: list[str]


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        task_id = path_params.get("taskId", "")
        body = validate_body(AssignTaskRequest, event.get("body"))
        dto = body.model_dump()
        dto["project_id"] = project_id
        dto["task_id"] = task_id
        task_repo = TaskDynamoRepository()
        project_repo = ProjectDynamoRepository()
        use_case = AssignTaskUseCase(task_repo, project_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
