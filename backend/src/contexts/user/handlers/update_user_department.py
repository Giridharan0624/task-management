from datetime import datetime, timezone

from pydantic import BaseModel

from contexts.org.domain import permissions as P
from contexts.user.domain.entities import User
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class UpdateDepartmentRequest(BaseModel):
    user_id: str
    department: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require(auth, P.USER_UPDATE_ANY)

        body = validate_body(UpdateDepartmentRequest, event.get("body"))
        user_repo = UserDynamoRepository()

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
