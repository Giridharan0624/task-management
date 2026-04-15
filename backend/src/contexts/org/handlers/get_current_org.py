"""Authed GET /orgs/current handler.

Returns the full org + settings + plan for the caller's current
organization, resolved from `AuthContext.org_id` (which itself comes from
the `custom:orgId` JWT claim injected by the pre-token-generation trigger).

Callers receive this payload after login and use it to hydrate the
TenantProvider context on the frontend.
"""
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        repo = OrgDynamoRepository()
        org = repo.find_by_id(auth.org_id)
        if not org:
            raise NotFoundError(f"Organization '{auth.org_id}' not found")

        settings = repo.get_settings(auth.org_id)
        plan = repo.get_plan(auth.org_id)

        return build_success(200, {
            "org": org.to_dict(),
            "settings": settings.to_dict() if settings else None,
            "plan": plan.to_dict() if plan else None,
        })
    except Exception as e:
        return build_error(e)
