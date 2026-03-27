from datetime import datetime, timezone

from pydantic import BaseModel

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from domain.user.entities import User
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError


class UpdateDepartmentRequest(BaseModel):
    user_id: str
    department: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateDepartmentRequest, event.get("body"))
        user_repo = UserDynamoRepository()

        # OWNER can change anyone's department, ADMIN can change only MEMBERs
        if auth.system_role == SystemRole.OWNER.value:
            pass
        elif auth.system_role == SystemRole.ADMIN.value:
            target = user_repo.find_by_id(body.user_id)
            if not target:
                raise NotFoundError("User not found")
            if target.system_role != SystemRole.MEMBER:
                raise AuthorizationError("Admins can only change department of members")
        else:
            raise AuthorizationError("Only owners and admins can change departments")

        target_user = user_repo.find_by_id(body.user_id)
        if not target_user:
            raise NotFoundError("User not found")

        updated = User(
            **{**target_user.model_dump(), "department": body.department, "updated_at": datetime.now(timezone.utc).isoformat()}
        )
        user_repo.update(updated)
        return build_success(200, updated.to_dict())
    except Exception as e:
        return build_error(e)
