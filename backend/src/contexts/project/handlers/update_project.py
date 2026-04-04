from typing import Optional

from pydantic import BaseModel

from contexts.project.application.use_cases import UpdateProjectUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_hours: Optional[float] = None
    domain: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateProjectRequest, event.get("body"))
        project_id = event["pathParameters"]["projectId"]
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        task_repo = TaskDynamoRepository()
        use_case = UpdateProjectUseCase(project_repo, user_repo, task_repo)
        dto = {**body.model_dump(exclude_none=True), "project_id": project_id}
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
