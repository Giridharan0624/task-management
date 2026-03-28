from application.dayoff.use_cases import GetMyRequestsUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.dayoff_repository import DayOffDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        dayoff_repo = DayOffDynamoRepository()
        use_case = GetMyRequestsUseCase(dayoff_repo)
        result = use_case.execute(caller_user_id=auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
