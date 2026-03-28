import json

from pydantic import BaseModel

from application.dayoff.use_cases import CreateDayOffRequestUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.dayoff_repository import DayOffDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository


class CreateDayOffBody(BaseModel):
    start_date: str
    end_date: str
    reason: str
    admin_id: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(CreateDayOffBody, event.get("body"))

        dayoff_repo = DayOffDynamoRepository()
        user_repo = UserDynamoRepository()
        project_repo = ProjectDynamoRepository()

        use_case = CreateDayOffRequestUseCase(dayoff_repo, user_repo, project_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            start_date=body.start_date,
            end_date=body.end_date,
            reason=body.reason,
            admin_id=body.admin_id,
        )
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
