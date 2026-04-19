"""Authed GET /orgs/current handler.

Returns the full org + settings + plan + pipelines for the caller's
current organization, resolved from `AuthContext.org_id` (which itself
comes from the `custom:orgId` JWT claim injected by the pre-token
trigger).

Pipelines are folded into this response so the frontend gets a single
hydration call on app load — saves a Lambda + a route binding (the stack
is tight against the 500-resource CFN cap). Falls back to the in-memory
default pipelines when the org has none stored, same behavior the
dropped `list_pipelines` endpoint had.
"""
from contexts.org.domain.default_pipelines import build_default_pipelines
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
        pipelines = repo.list_pipelines(auth.org_id)
        if not pipelines:
            pipelines = [p.to_dict() for p in build_default_pipelines(auth.org_id)]

        return build_success(200, {
            "org": org.to_dict(),
            "settings": settings.to_dict() if settings else None,
            "plan": plan.to_dict() if plan else None,
            "pipelines": pipelines,
        })
    except Exception as e:
        return build_error(e)
