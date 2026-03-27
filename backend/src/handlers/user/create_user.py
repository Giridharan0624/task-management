from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.cognito.cognito_service import CognitoService
from application.user.use_cases import CreateUserUseCase
from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    email: str
    name: str
    password: str
    system_role: str = "MEMBER"
    department: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(CreateUserRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        cognito_service = CognitoService()
        use_case = CreateUserUseCase(user_repo, cognito_service)
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
