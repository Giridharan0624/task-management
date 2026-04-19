import json

from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.response import build_error, build_success
from shared_kernel.tenant_keys import DEFAULT_ORG_ID


def handler(event, context):
    """Public endpoint (no auth) — resolves employee_id to email for login.

    Pre-auth: no JWT yet, so org_id must come from the `workspace` query
    parameter. Falls back to DEFAULT_ORG_ID (neurostack) for backward
    compatibility with login flows that don't pass workspace yet.

    Returns 404 if either the workspace doesn't exist or the employee
    isn't in that workspace — never differentiates so attackers can't
    enumerate which workspaces have which employee IDs.
    """
    try:
        params = event.get("queryStringParameters") or {}
        employee_id = params.get("employeeId") or params.get("employee_id") or ""
        workspace = (
            params.get("workspace") or params.get("workspaceCode") or ""
        ).strip().lower()

        if not employee_id:
            return build_success(400, {"error": "employeeId is required"})

        org_id = DEFAULT_ORG_ID
        if workspace:
            org_repo = OrgDynamoRepository()
            org = org_repo.find_by_slug(workspace)
            if not org:
                # Don't leak which workspaces exist
                return build_success(404, {"error": "Employee not found"})
            org_id = org.org_id

        user_repo = UserDynamoRepository(org_id=org_id)
        user = user_repo.find_by_employee_id(employee_id.upper())

        if not user:
            return build_success(404, {"error": "Employee not found"})

        # Only return the email — don't expose other data publicly
        return build_success(200, {"email": user.email, "employee_id": user.employee_id})
    except Exception as e:
        return build_error(e)
