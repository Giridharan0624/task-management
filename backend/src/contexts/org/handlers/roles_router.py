"""Single Lambda handling all /orgs/current/roles[/{roleId}] methods.

We collapse list/create/update/delete into one Lambda because the stack
is tight against the 500-resource CloudFormation cap (each separate
Lambda adds ~5 resources: function, role, policy, permission, method).
A single dispatch handler costs the same single set of resources for
the four methods combined.

Dispatch rules:
  GET    /orgs/current/roles            → list_roles
  POST   /orgs/current/roles            → create_role
  PUT    /orgs/current/roles/{roleId}   → update_role
  DELETE /orgs/current/roles/{roleId}   → delete_role
  *                                     → 405 Method Not Allowed
"""
from contexts.org.handlers import (
    create_role,
    delete_role,
    list_roles,
    update_role,
)
from shared_kernel.response import build_success


def handler(event, context):
    method = (event or {}).get("httpMethod", "").upper()
    has_role_id = bool((event or {}).get("pathParameters") or {})

    if method == "GET" and not has_role_id:
        return list_roles.handler(event, context)
    if method == "POST" and not has_role_id:
        return create_role.handler(event, context)
    if method == "PUT" and has_role_id:
        return update_role.handler(event, context)
    if method == "DELETE" and has_role_id:
        return delete_role.handler(event, context)

    # Fall-through. build_error wants an exception; cheaper to hand-craft.
    return build_success(
        405, {"error": f"Method {method} not allowed on this resource"}
    )
