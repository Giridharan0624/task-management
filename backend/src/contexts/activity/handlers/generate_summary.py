import json

from contexts.activity.application.use_cases import GenerateSummaryUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_feature
from shared_kernel.response import build_error, build_success
from contexts.activity.infrastructure.dynamo_repository import ActivityDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        # AI summary generation can be turned off at the org level.
        # Existing summaries remain readable via get_summary; only new
        # generations are blocked. The auto-generate scheduled job
        # honors the same gate via the per-org loop in
        # `auto_generate_summaries.py`.
        require_feature(auth, "ai_summaries")

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
