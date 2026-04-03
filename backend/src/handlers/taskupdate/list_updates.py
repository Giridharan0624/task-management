from datetime import datetime, timezone, timedelta

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.taskupdate_repository import TaskUpdateDynamoRepository
from domain.user.value_objects import PRIVILEGED_ROLES
from shared.errors import AuthorizationError

IST = timezone(timedelta(hours=5, minutes=30))


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        if auth.system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only owners and admins can view all task updates")

        query_params = event.get("queryStringParameters") or {}
        date = query_params.get("date", datetime.now(IST).strftime("%Y-%m-%d"))

        update_repo = TaskUpdateDynamoRepository()
        updates = update_repo.find_by_date(date)

        return build_success(200, [u.to_dict() for u in updates])
    except Exception as e:
        return build_error(e)
