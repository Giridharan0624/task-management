from __future__ import annotations

from typing import Optional

from contexts.integrations.domain.entities import Integration
from contexts.integrations.domain.repository import IIntegrationRepository
from shared_kernel.errors import NotFoundError


def list_integrations(
    *,
    org_id: str,
    repo: IIntegrationRepository,
) -> list[Integration]:
    return repo.list_for_org(org_id)


def get_integration(
    *,
    integration_id: str,
    repo: IIntegrationRepository,
) -> Integration:
    integration = repo.find_by_id(integration_id)
    if integration is None:
        raise NotFoundError(f"Integration {integration_id} not found")
    return integration


def integration_to_public_dict(integration: Integration) -> dict:
    """The shape we ship to the frontend. Critically: NEVER include the
    encrypted credentials blob or the webhook secret hash."""
    return {
        "integration_id": integration.integration_id,
        "provider": integration.provider,
        "display_name": integration.display_name,
        "account_id": integration.account_id,
        "status": integration.status.value,
        "assignee_mode": integration.assignee_mode.value,
        "fallback_assignee_id": integration.fallback_assignee_id,
        "linked_project_id": integration.linked_project_id,
        "last_error": integration.last_error,
        "connected_at": integration.connected_at,
        "connected_by": integration.connected_by,
        "updated_at": integration.updated_at,
    }


def integrations_to_public_list(integrations: list[Integration]) -> list[dict]:
    return [integration_to_public_dict(i) for i in integrations]


def get_integration_or_none(
    *,
    integration_id: str,
    repo: IIntegrationRepository,
) -> Optional[Integration]:
    return repo.find_by_id(integration_id)
