"""POST /integrations/{provider}

Body: arbitrary JSON shape declared by the connector's connect_form_schema.
Response: 200 with the new integration record + a one-time webhook secret.
"""
from __future__ import annotations

import json

from contexts.integrations.application.connect_integration import connect_integration
from contexts.integrations.application.list_integrations import (
    integration_to_public_dict,
)
from contexts.integrations.application.plan_gate import enforce_can_connect
from contexts.integrations.domain.connector_registry import default_registry
from contexts.integrations.domain.value_objects import AssigneeMode
from contexts.integrations.infrastructure.integration_repo_dynamo import (
    IntegrationDynamoRepository,
)
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)

        path_params = event.get("pathParameters") or {}
        provider = path_params.get("provider")
        if not provider:
            raise ValidationError("missing provider in path")

        connector = default_registry.try_get(provider)
        if connector is None:
            raise NotFoundError(f"Unknown provider: {provider}")

        body_raw = event.get("body") or "{}"
        body = json.loads(body_raw)
        form_payload = body.get("form", {}) or {}
        mode_str = body.get("assignee_mode", AssigneeMode.STRICT.value)
        try:
            mode = AssigneeMode(mode_str)
        except ValueError:
            raise ValidationError(f"invalid assignee_mode: {mode_str}")

        repo = IntegrationDynamoRepository(org_id=auth.org_id)

        # Plan gate: blocks Free/Starter and enforces per-tier integration
        # cap. Counts ACROSS all providers for the org.
        enforce_can_connect(auth.org_id, integration_repo=repo)

        integration, webhook_secret = connect_integration(
            org_id=auth.org_id,
            user_id=auth.user_id,
            connector=connector,
            raw_form_payload=form_payload,
            repo=repo,
            assignee_mode=mode,
            fallback_assignee_id=body.get("fallback_assignee_id"),
            linked_project_id=body.get("linked_project_id"),
        )

        return build_success(
            201,
            {
                "integration": integration_to_public_dict(integration),
                "webhook_secret": webhook_secret,
                "webhook_url_path": f"/integration-webhooks/{provider}/webhook/{auth.org_id}/{integration.integration_id}",
            },
        )
    except Exception as e:
        return build_error(e)
