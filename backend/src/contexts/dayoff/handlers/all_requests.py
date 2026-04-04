from contexts.dayoff.application.use_cases import GetAllRequestsUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.dayoff.infrastructure.dynamo_repository import DayOffDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        dayoff_repo = DayOffDynamoRepository()
        use_case = GetAllRequestsUseCase(dayoff_repo)
        result = use_case.execute(
            caller_user_id=auth.user_id,
            caller_system_role=auth.system_role,
        )
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
