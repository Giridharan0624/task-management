from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from domain.user.value_objects import SystemRole


def handler(event, context):
    """Returns a list of admins (name + userId only) for any authenticated user."""
    try:
        extract_auth_context(event)  # just verify auth
        user_repo = UserDynamoRepository()
        users = user_repo.find_all()
        admins = [
            {"user_id": u.user_id, "name": u.name, "email": u.email, "employee_id": u.employee_id}
            for u in users
            if u.system_role in (SystemRole.ADMIN, SystemRole.OWNER)
        ]
        return build_success(200, admins)
    except Exception as e:
        return build_error(e)
