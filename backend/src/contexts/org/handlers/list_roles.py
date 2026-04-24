"""GET /orgs/current/roles — list role records for the caller's org.

Anyone authenticated within the org can read the role list (so the UI
can render which permissions their role grants). Editing roles is
gated separately by `role.manage`.

Redaction rules:
  - Callers with `role.manage`: see the full permission matrix for
    every role (so the Roles & Permissions editor works).
  - Everyone else: see the full permission list for THEIR OWN role
    (so the frontend `useSystemPermission` hook can compute live
    `canXyz` booleans from the tenant's current role definition),
    and only the role NAME for every other role (so assignee
    dropdowns can label options without leaking per-role
    permissions they don't need to know).

Before Session 8 this endpoint stripped permissions from every role
for non-managers, which broke the frontend permission hook — an
Admin couldn't even see what their own Admin role was allowed to do.
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

        if not has_permission(auth, P.ROLE_MANAGE):
            # The caller's own role_id is whichever of (role_id,
            # system_role) resolves — prefer the Phase-4 claim.
            own_role_id = (
                (auth.role_id or auth.system_role or "").strip().lower()
            )
            roles = [
                r if r.get("role_id") == own_role_id
                else {**r, "permissions": []}
                for r in roles
            ]

        return build_success(200, {
            "roles": roles,
            "all_permissions": sorted(P.ALL_PERMISSIONS),
        })
    except Exception as e:
        return build_error(e)
