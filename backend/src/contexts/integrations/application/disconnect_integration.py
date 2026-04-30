from __future__ import annotations

from contexts.integrations.domain.repository import IIntegrationRepository
from shared_kernel.errors import NotFoundError


def disconnect_integration(
    *,
    integration_id: str,
    repo: IIntegrationRepository,
) -> None:
    """Hard-delete the integration record. ExternalLink rows are intentionally
    kept for audit; admins can clear them via a separate purge action."""
    integration = repo.find_by_id(integration_id)
    if integration is None:
        raise NotFoundError(f"Integration {integration_id} not found")
    repo.delete(integration_id)
