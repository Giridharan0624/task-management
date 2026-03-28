from application.dayoff.use_cases import RejectRequestUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.dayoff_repository import DayOffDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        request_id = event.get("pathParameters", {}).get("requestId", "")

        dayoff_repo = DayOffDynamoRepository()
        use_case = RejectRequestUseCase(dayoff_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            request_id=request_id,
        )
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
