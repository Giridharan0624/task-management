from datetime import datetime, timezone

from pydantic import BaseModel

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from shared.errors import NotFoundError


class UpdateProfileRequest(BaseModel):
    name: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateProfileRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(auth.user_id)
        if not user:
            raise NotFoundError(f"User {auth.user_id} not found")

        from domain.user.entities import User

        updated_user = User(
            user_id=user.user_id,
            email=user.email,
            name=body.name,
            system_role=user.system_role,
            created_at=user.created_at,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        user_repo.update(updated_user)
        return build_success(200, updated_user.to_dict())
    except Exception as e:
        return build_error(e)
