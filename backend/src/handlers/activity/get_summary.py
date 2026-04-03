from application.activity.use_cases import GetSummaryUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.activity_repository import ActivityDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        params = event.get("queryStringParameters") or {}
        target_user_id = params.get("userId", auth.user_id)
        date = params.get("date", "")

        activity_repo = ActivityDynamoRepository()
        use_case = GetSummaryUseCase(activity_repo)
        result = use_case.execute(auth.user_id, auth.system_role, target_user_id, date)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
