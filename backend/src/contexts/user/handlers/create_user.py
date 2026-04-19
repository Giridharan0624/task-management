from shared_kernel.response import build_success, build_error
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.validate_body import validate_body
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.infrastructure.cognito_service import CognitoService
from contexts.user.application.use_cases import CreateUserUseCase
from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    email: str
    name: str
    system_role: str = "MEMBER"
    department: str
    date_of_joining: str = ""


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(CreateUserRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        org_repo = OrgDynamoRepository()
        cognito_service = CognitoService()
        use_case = CreateUserUseCase(user_repo, cognito_service, org_repo=org_repo)
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role, auth.org_id)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
