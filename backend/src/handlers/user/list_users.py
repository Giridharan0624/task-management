from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from application.user.use_cases import ListUsersUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_repo = UserDynamoRepository()
        use_case = ListUsersUseCase(user_repo)
        result = use_case.execute(auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
