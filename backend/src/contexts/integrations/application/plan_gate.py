"""Plan-gate enforcement for the integration platform.

Lives in the integration context so neither `org` nor `plan` need to know
about integrations. Reads the Org plan via the existing repository and
applies platform-wide limits.

Limits (apply across ALL connectors for a given org):
  - FREE / no plan       → 0 integrations (can never connect)
  - PRO                  → 3 integrations
  - ENTERPRISE           → unlimited

Per-connector additional plan rules (e.g. a future Salesforce connector
being Enterprise-only) can be enforced inside the connector's own
verify_credentials by raising — they layer on top of this base gate.
"""
from __future__ import annotations

from contexts.integrations.domain.repository import IIntegrationRepository
from contexts.org.domain.value_objects import PlanTier
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.errors import AuthorizationError


_LIMITS_PER_TIER: dict[PlanTier, int | None] = {
    PlanTier.FREE: 0,
    PlanTier.PRO: 3,
    PlanTier.ENTERPRISE: None,  # unlimited
}


def enforce_can_connect(
    org_id: str,
    *,
    integration_repo: IIntegrationRepository,
    org_repo: OrgDynamoRepository | None = None,
) -> None:
    """Raise if the org's plan prohibits adding another integration."""
    org_repo = org_repo or OrgDynamoRepository()
    plan = org_repo.get_plan(org_id)
    if plan is None:
        raise AuthorizationError(
            "Your workspace does not have an active plan. Upgrade to Pro or Enterprise to connect integrations.",
            code="INTEGRATIONS_PLAN_REQUIRED",
        )

    tier = plan.tier
    limit = _LIMITS_PER_TIER.get(tier, 0)
    if limit == 0:
        raise AuthorizationError(
            f"Your plan ({tier.value}) does not include integrations. Upgrade to Pro or Enterprise.",
            code="INTEGRATIONS_PLAN_BLOCKED",
        )

    if limit is None:
        return  # Enterprise — unlimited.

    current = integration_repo.count_active_for_org(org_id)
    if current >= limit:
        raise AuthorizationError(
            f"Your plan ({tier.value}) allows up to {limit} active integrations. "
            "Disconnect an existing one or upgrade to Enterprise to add more.",
            code="INTEGRATIONS_PLAN_LIMIT_REACHED",
        )
