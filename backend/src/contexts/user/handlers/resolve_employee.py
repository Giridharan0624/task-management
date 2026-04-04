import json

from shared_kernel.response import build_error, build_success
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


def handler(event, context):
    """Public endpoint (no auth) — resolves employee_id to email for login."""
    try:
        params = event.get("queryStringParameters") or {}
        employee_id = params.get("employeeId") or params.get("employee_id") or ""

        if not employee_id:
            return build_success(400, {"error": "employeeId is required"})

        user_repo = UserDynamoRepository()
        user = user_repo.find_by_employee_id(employee_id.upper())

        if not user:
            return build_success(404, {"error": "Employee not found"})

        # Only return the email — don't expose other data publicly
        return build_success(200, {"email": user.email, "employee_id": user.employee_id})
    except Exception as e:
        return build_error(e)
