"""GET /integrations — list every integration for the caller's org."""
from __future__ import annotations

from contexts.integrations.application.list_integrations import (
    integrations_to_public_list,
    list_integrations,
)
from contexts.integrations.infrastructure.integration_repo_dynamo import (
    IntegrationDynamoRepository,
)
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        repo = IntegrationDynamoRepository(org_id=auth.org_id)
        integrations = list_integrations(org_id=auth.org_id, repo=repo)
        return build_success(200, {"integrations": integrations_to_public_list(integrations)})
    except Exception as e:
        return build_error(e)
