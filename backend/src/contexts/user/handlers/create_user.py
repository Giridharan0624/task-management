from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.application.use_cases import CreateUserUseCase
from contexts.user.infrastructure.cognito_service import CognitoService
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from pydantic import BaseModel
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class CreateUserRequest(BaseModel):
    email: str
    name: str
    system_role: str = "MEMBER"
    department: str
    date_of_joining: str = ""


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)

        body = validate_body(CreateUserRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        org_repo = OrgDynamoRepository()
        cognito_service = CognitoService()
        use_case = CreateUserUseCase(user_repo, cognito_service, org_repo=org_repo)
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role, auth.org_id)
        audit.record(
            auth,
            action=audit.USER_CREATED,
            target={"type": "user", "id": result.get("user_id", "")},
            summary=f"Created user {body.email} ({body.system_role})",
        )
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
