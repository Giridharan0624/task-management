from shared_kernel.response import build_success, build_error
from shared_kernel.auth_context import extract_auth_context
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.application.use_cases import ListUsersUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_repo = UserDynamoRepository()
        use_case = ListUsersUseCase(user_repo)
        result = use_case.execute(auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
