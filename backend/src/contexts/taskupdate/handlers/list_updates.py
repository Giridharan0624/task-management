from datetime import datetime, timezone, timedelta

from contexts.org.domain import permissions as P
from contexts.taskupdate.infrastructure.dynamo_repository import TaskUpdateDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success

IST = timezone(timedelta(hours=5, minutes=30))


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require(auth, P.TASKUPDATE_LIST_ALL)

        query_params = event.get("queryStringParameters") or {}
        date = query_params.get("date", datetime.now(IST).strftime("%Y-%m-%d"))

        update_repo = TaskUpdateDynamoRepository()
        updates = update_repo.find_by_date(date)

        return build_success(200, [u.to_dict() for u in updates])
    except Exception as e:
        return build_error(e)
