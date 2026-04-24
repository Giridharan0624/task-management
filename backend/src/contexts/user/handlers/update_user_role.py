from shared_kernel.response import build_success, build_error
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.validate_body import validate_body
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.infrastructure.cognito_service import CognitoService
from contexts.user.application.use_cases import UpdateUserRoleUseCase
from pydantic import BaseModel


class UpdateUserRoleRequest(BaseModel):
    user_id: str
    system_role: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateUserRoleRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        org_repo = OrgDynamoRepository()
        cognito_service = CognitoService()
        # org_repo + auth.org_id enable the use case to validate custom
        # role_ids against the tenant's live role records — without them
        # only the three built-in tiers (ADMIN / MEMBER) are accepted.
        use_case = UpdateUserRoleUseCase(
            user_repo,
            cognito_service,
            org_repo=org_repo,
            org_id=auth.org_id,
        )
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
