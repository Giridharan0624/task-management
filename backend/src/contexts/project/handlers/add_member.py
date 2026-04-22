from typing import Optional

from pydantic import BaseModel

from contexts.org.domain.default_project_roles import PROJECT_MEMBER_ROLE_ID
from contexts.project.application.use_cases import AddProjectMemberUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


class AddMemberRequest(BaseModel):
    user_id: str
    # Canonical field. Accepts seeded IDs (project_admin / project_manager /
    # team_lead / project_member) plus any tenant-defined custom role_id
    # that has scope='project'.
    project_role_id: Optional[str] = None
    # Legacy field — pre-refactor clients sent the enum value here.
    # Translated to `project_role_id` via normalize_project_role_id in
    # the use case.
    project_role: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        body = validate_body(AddMemberRequest, event.get("body"))
        dto = body.model_dump(exclude_none=True)
        # Default when neither field is supplied — least-privilege.
        dto.setdefault("project_role_id", PROJECT_MEMBER_ROLE_ID)
        dto["project_id"] = project_id
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = AddProjectMemberUseCase(project_repo, user_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
