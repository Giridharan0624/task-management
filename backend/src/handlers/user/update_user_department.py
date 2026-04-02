from datetime import datetime, timezone

from pydantic import BaseModel

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from domain.user.entities import User
from domain.user.value_objects import SystemRole, PRIVILEGED_ROLES
from shared.errors import AuthorizationError, NotFoundError


class UpdateDepartmentRequest(BaseModel):
    user_id: str
    department: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateDepartmentRequest, event.get("body"))
        user_repo = UserDynamoRepository()

        # OWNER and ADMIN can change anyone's department
        if auth.system_role not in PRIVILEGED_ROLES:
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
