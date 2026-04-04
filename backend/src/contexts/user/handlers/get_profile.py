from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.domain.entities import User
from contexts.user.domain.value_objects import SystemRole


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(auth.user_id)
        if not user:
            # Auto-create profile from JWT claims
            claims = (
                event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
            )
            try:
                system_role = SystemRole(auth.system_role)
            except ValueError:
                system_role = SystemRole.MEMBER

            user = User.create(
                user_id=auth.user_id,
                email=auth.email,
                name=claims.get("name", auth.email),
                system_role=system_role,
            )
            user_repo.save(user)
        return build_success(200, user.to_dict())
    except Exception as e:
        return build_error(e)
