from contexts.dayoff.application.use_cases import RejectRequestUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.dayoff.infrastructure.dynamo_repository import DayOffDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        request_id = event.get("pathParameters", {}).get("requestId", "")

        dayoff_repo = DayOffDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = RejectRequestUseCase(dayoff_repo, user_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            caller_system_role=auth.system_role,
            request_id=request_id,
        )
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
