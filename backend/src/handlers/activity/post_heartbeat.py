import json

from application.activity.use_cases import RecordHeartbeatUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.activity_repository import ActivityDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        body = {}
        raw_body = event.get("body")
        if raw_body:
            body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        activity_repo = ActivityDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = RecordHeartbeatUseCase(activity_repo, user_repo)
        result = use_case.execute(caller_user_id=auth.user_id, data=body)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
