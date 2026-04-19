"""GET /orgs/current/roles — list role records for the caller's org.

Anyone authenticated within the org can read the role list (so the UI
can render which permissions their role grants). Editing roles is
gated separately by `role.manage`.
"""
from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import has_permission
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        repo = OrgDynamoRepository()
        roles = repo.list_roles(auth.org_id)

        # Hide the full permission list from non-managers — they only need
        # to know the role names exist (for assignment dropdowns). Owners
        # and anyone with role.manage see the full matrix.
        if not has_permission(auth, P.ROLE_MANAGE):
            roles = [
                {**r, "permissions": []}
                for r in roles
            ]

        return build_success(200, {"roles": roles, "all_permissions": sorted(P.ALL_PERMISSIONS)})
    except Exception as e:
        return build_error(e)
