from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from contexts.org.domain.entities import Plan
from contexts.org.domain.value_objects import PlanTier


class PlanTemplate(BaseModel):
    tier: PlanTier
    max_users: Optional[int]
    max_projects: Optional[int]
    retention_days: Optional[int]
    features_allowed: set[str]


FREE_FEATURES = {
    "birthday_wishes",
    "activity_monitoring",
    "day_offs",
    "comments",
    "task_updates",
}

# AI-powered features (activity day-summaries via Groq + AI weekly
# rollup with anomaly detection) are PRO-tier only. They both call the
# `ai_summaries` flag — the umbrella covers every Groq round-trip the
# product makes, so a single plan upgrade unlocks both surfaces.
PRO_FEATURES = FREE_FEATURES | {
    "ai_summaries",
    "screenshots",
    "custom_pipelines",
    "custom_roles",
    "api_access",
}

ENTERPRISE_FEATURES = PRO_FEATURES | {
    "sso",
    "audit_logs",
    "white_label",
    "custom_domain",
}


FREE = PlanTemplate(
    tier=PlanTier.FREE,
    max_users=10,
    max_projects=3,
    retention_days=30,
    features_allowed=FREE_FEATURES,
)

PRO = PlanTemplate(
    tier=PlanTier.PRO,
    max_users=50,
    max_projects=50,
    retention_days=365,
    features_allowed=PRO_FEATURES,
)

ENTERPRISE = PlanTemplate(
    tier=PlanTier.ENTERPRISE,
    max_users=None,
    max_projects=None,
    retention_days=None,
    features_allowed=ENTERPRISE_FEATURES,
)


def get_template(tier: PlanTier) -> PlanTemplate:
    return {
        PlanTier.FREE: FREE,
        PlanTier.PRO: PRO,
        PlanTier.ENTERPRISE: ENTERPRISE,
    }[tier]


def plan_from_template(org_id: str, tier: PlanTier) -> Plan:
    template = get_template(tier)
    now = datetime.now(timezone.utc).isoformat()
    return Plan(
        org_id=org_id,
        tier=template.tier,
        max_users=template.max_users,
        max_projects=template.max_projects,
        retention_days=template.retention_days,
        features_allowed=template.features_allowed,
        created_at=now,
        updated_at=now,
    )
