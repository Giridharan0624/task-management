import json

from contexts.activity.application.use_cases import GenerateSummaryUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.activity.infrastructure.dynamo_repository import ActivityDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        body = {}
        raw_body = event.get("body")
        if raw_body:
            body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        activity_repo = ActivityDynamoRepository()
        use_case = GenerateSummaryUseCase(activity_repo)
        result = use_case.execute(
            caller_system_role=auth.system_role,
            target_user_id=body.get("user_id", ""),
            date=body.get("date", ""),
            task_context=body.get("task_context", ""),
        )
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
