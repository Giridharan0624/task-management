from pydantic import BaseModel

from contexts.dayoff.application.use_cases import CreateDayOffRequestUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.dayoff.infrastructure.dynamo_repository import DayOffDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


class CreateDayOffBody(BaseModel):
    start_date: str
    end_date: str
    reason: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(CreateDayOffBody, event.get("body"))

        dayoff_repo = DayOffDynamoRepository()
        user_repo = UserDynamoRepository()

        use_case = CreateDayOffRequestUseCase(dayoff_repo, user_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            start_date=body.start_date,
            end_date=body.end_date,
            reason=body.reason,
        )
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
