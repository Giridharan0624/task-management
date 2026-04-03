from application.activity.use_cases import GetActivityReportUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.activity_repository import ActivityDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        params = event.get("queryStringParameters") or {}
        start_date = params.get("startDate", "")
        end_date = params.get("endDate", "")

        activity_repo = ActivityDynamoRepository()
        use_case = GetActivityReportUseCase(activity_repo)
        result = use_case.execute(auth.system_role, start_date, end_date)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
