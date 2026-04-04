from typing import Optional

from pydantic import BaseModel

from contexts.project.application.use_cases import CreateProjectUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    domain: Optional[str] = "DEVELOPMENT"
    team_lead_id: Optional[str] = None
    project_manager_id: Optional[str] = None
    member_ids: list[str] = []


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(CreateProjectRequest, event.get("body"))
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = CreateProjectUseCase(project_repo, user_repo)
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
