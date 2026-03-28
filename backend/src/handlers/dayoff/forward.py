import json

from pydantic import BaseModel

from application.dayoff.use_cases import ForwardRequestUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.dayoff_repository import DayOffDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class ForwardBody(BaseModel):
    forward_to_id: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        request_id = event.get("pathParameters", {}).get("requestId", "")
        body = validate_body(ForwardBody, event.get("body"))

        dayoff_repo = DayOffDynamoRepository()
        user_repo = UserDynamoRepository()

        use_case = ForwardRequestUseCase(dayoff_repo, user_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            caller_system_role=auth.system_role,
            request_id=request_id,
            forward_to_id=body.forward_to_id,
        )
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
