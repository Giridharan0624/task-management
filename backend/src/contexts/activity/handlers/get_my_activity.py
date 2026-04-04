from contexts.activity.application.use_cases import GetMyActivityUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.activity.infrastructure.dynamo_repository import ActivityDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        params = event.get("queryStringParameters") or {}
        date = params.get("date")

        activity_repo = ActivityDynamoRepository()
        use_case = GetMyActivityUseCase(activity_repo)
        result = use_case.execute(auth.user_id, date)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
