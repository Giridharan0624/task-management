from typing import Optional

from pydantic import BaseModel

from application.project.use_cases import UpdateProjectUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    estimated_hours: Optional[float] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateProjectRequest, event.get("body"))
        project_id = event["pathParameters"]["projectId"]
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = UpdateProjectUseCase(project_repo, user_repo)
        dto = {**body.model_dump(exclude_none=True), "project_id": project_id}
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
