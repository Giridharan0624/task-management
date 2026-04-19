"""GET /orgs/current/pipelines — list this org's task pipelines.

Anyone in the org can read pipelines (the kanban board renders them).
Falls back to the four default pipelines if the org has none stored —
keeps existing tenants and frontends working during the Phase 5 rollout
window before pipelines are backfilled.
"""
from contexts.org.domain.default_pipelines import build_default_pipelines
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        repo = OrgDynamoRepository()
        pipelines = repo.list_pipelines(auth.org_id)
        if not pipelines:
            # Lazy backfill: emit the defaults from memory so the UI always
            # has something to render. The first signup writes them to DDB;
            # this branch covers existing tenants from before Phase 5 ships.
            pipelines = [p.to_dict() for p in build_default_pipelines(auth.org_id)]
        return build_success(200, {"pipelines": pipelines})
    except Exception as e:
        return build_error(e)
