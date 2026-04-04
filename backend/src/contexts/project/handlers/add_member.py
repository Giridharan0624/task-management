from pydantic import BaseModel

from contexts.project.application.use_cases import AddProjectMemberUseCase
from contexts.project.domain.value_objects import ProjectRole
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


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
