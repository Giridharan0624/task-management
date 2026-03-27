from pydantic import BaseModel

from application.project.use_cases import AddProjectMemberUseCase
from domain.project.value_objects import ProjectRole
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class AddMemberRequest(BaseModel):
    user_id: str
    project_role: ProjectRole = ProjectRole.MEMBER


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        body = validate_body(AddMemberRequest, event.get("body"))
        dto = body.model_dump()
        dto["project_id"] = project_id
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = AddProjectMemberUseCase(project_repo, user_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
