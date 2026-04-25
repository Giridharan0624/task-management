"""GET /day-offs/my — caller's day-off requests, or their leave balance.

Collapsed router: a single Lambda + API Gateway method serves two views to
stay under the parent stack's 500-resource CFN cap. Pass `?view=balance`
to get the per-leave-type quota breakdown; default returns the request list.
"""
from contexts.dayoff.application.use_cases import (
    GetDayOffBalanceUseCase,
    GetMyRequestsUseCase,
)
from contexts.dayoff.infrastructure.dynamo_repository import DayOffDynamoRepository
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        qs = event.get("queryStringParameters") or {}
        view = (qs.get("view") or "").lower()

        if view == "balance":
            year_param = qs.get("year")
            year = int(year_param) if year_param else None
            use_case = GetDayOffBalanceUseCase(
                DayOffDynamoRepository(),
                OrgDynamoRepository(),
                auth.org_id,
            )
            result = use_case.execute(caller_user_id=auth.user_id, year=year)
            return build_success(200, result)

        use_case = GetMyRequestsUseCase(DayOffDynamoRepository())
        result = use_case.execute(caller_user_id=auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
