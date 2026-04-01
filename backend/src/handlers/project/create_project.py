from typing import Optional

from pydantic import BaseModel

from application.project.use_cases import CreateProjectUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    domain: Optional[str] = "DEVELOPMENT"
    team_lead_id: Optional[str] = None
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
