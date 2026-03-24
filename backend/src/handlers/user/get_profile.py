from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from shared.errors import NotFoundError


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(auth.user_id)
        if not user:
            raise NotFoundError(f"User {auth.user_id} not found")
        return build_success(200, user.to_dict())
    except Exception as e:
        return build_error(e)
