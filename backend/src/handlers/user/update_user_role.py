from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from application.user.use_cases import UpdateUserRoleUseCase
from pydantic import BaseModel


class UpdateUserRoleRequest(BaseModel):
    user_id: str
    system_role: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateUserRoleRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        use_case = UpdateUserRoleUseCase(user_repo)
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
