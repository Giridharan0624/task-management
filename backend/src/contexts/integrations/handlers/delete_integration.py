"""DELETE /integrations/{integration_id}"""
from __future__ import annotations

from contexts.integrations.application.disconnect_integration import (
    disconnect_integration,
)
from contexts.integrations.application.list_integrations import get_integration
from contexts.integrations.infrastructure.integration_repo_dynamo import (
    IntegrationDynamoRepository,
)
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, ValidationError
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)

        path_params = event.get("pathParameters") or {}
        integration_id = path_params.get("integration_id")
        if not integration_id:
            raise ValidationError("missing integration_id in path")

        repo = IntegrationDynamoRepository(org_id=auth.org_id)

        existing = get_integration(integration_id=integration_id, repo=repo)
        if existing.org_id != auth.org_id:
            raise AuthorizationError("Integration belongs to a different workspace")

        disconnect_integration(integration_id=integration_id, repo=repo)
        return build_success(200, {"status": "disconnected"})
    except Exception as e:
        return build_error(e)
