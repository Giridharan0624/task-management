from typing import Optional

from pydantic import BaseModel

from contexts.project.application.use_cases import UpdateMemberRoleUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import ValidationError
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


class UpdateMemberRoleRequest(BaseModel):
    # Accept either the canonical role_id or the legacy enum string
    # (ADMIN / PROJECT_MANAGER / TEAM_LEAD / MEMBER). Use-case translates
    # via normalize_project_role_id.
    project_role_id: Optional[str] = None
    project_role: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        user_id = path_params.get("userId", "")
        body = validate_body(UpdateMemberRoleRequest, event.get("body"))
        dto = body.model_dump(exclude_none=True)
        if "project_role_id" not in dto and "project_role" not in dto:
            raise ValidationError("project_role_id is required.")
        dto["project_id"] = project_id
        dto["user_id"] = user_id
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = UpdateMemberRoleUseCase(project_repo, user_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
