"""Nightly seat-count reconciliation.

The CreateUser handler enforces `plan.max_users` at write time, but a
race between two concurrent invite-accepts can land both rows even when
only one seat remains. This sweeper detects the resulting overflow and
records an audit event so the OWNER can act (remove a member, upgrade
the plan, or accept the temporary overflow).

What it does NOT do:
- Auto-suspend or auto-delete users. The system never quietly removes a
  human's account because of a billing edge case. Decisions stay manual.
- Re-charge billing. Stripe is parked.

Idempotent and side-effect-free except for the audit-log write. Safe to
run hourly if needed; designed for daily.

Not yet wired to a CloudWatch event in CDK (stack at 494/500). Until
the nested-stack refactor lands, this is dead code that the next deploy
attaches via `events.Rule` + `events_targets.LambdaFunction`.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from boto3.dynamodb.conditions import Attr

from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit, tenant_keys
from shared_kernel.auth_context import AuthContext
from shared_kernel.dynamo_client import get_table

log = logging.getLogger("taskflow.seat-reconciliation")
log.setLevel(logging.INFO)


@dataclass
class OverflowReport:
    org_id: str
    plan_tier: str
    seat_limit: int
    actual_seats: int
    overflow: int


def handler(event, context):
    """Iterate every org, compare seat usage to plan limit, audit any
    overflow. Returns a per-org summary for CloudWatch."""
    repo = OrgDynamoRepository()
    orgs = repo.list_all_orgs()

    summary: dict[str, Any] = {
        "orgs_scanned": 0,
        "orgs_unlimited": 0,
        "orgs_overflowing": 0,
        "overflows": [],
        "errors": [],
    }

    for org in orgs:
        summary["orgs_scanned"] += 1
        try:
            plan = repo.get_plan(org.org_id)
            if plan is None or plan.max_users is None:
                summary["orgs_unlimited"] += 1
                continue

            actual = _count_users(org.org_id)
            if actual <= plan.max_users:
                continue

            report = OverflowReport(
                org_id=org.org_id,
                plan_tier=plan.tier.value,
                seat_limit=plan.max_users,
                actual_seats=actual,
                overflow=actual - plan.max_users,
            )
            _record_overflow(report)
            summary["orgs_overflowing"] += 1
            summary["overflows"].append(report.__dict__)
        except Exception as e:
            summary["errors"].append({"org_id": org.org_id, "error": str(e)[:200]})

    return summary


def _count_users(org_id: str) -> int:
    """Count USER PROFILE items under this org. Done via scan (paginated)
    because there's no index keyed on (org, user-count). Acceptable for
    a nightly job; if it gets expensive we add a counter item."""
    table = get_table()
    count = 0
    response = table.scan(
        FilterExpression=(
            Attr("PK").begins_with(f"{tenant_keys.org_pk(org_id)}#USER#")
            & Attr("SK").eq(tenant_keys.user_sk())
        ),
        Select="COUNT",
    )
    count += response.get("Count", 0)
    while "LastEvaluatedKey" in response:
        response = table.scan(
            FilterExpression=(
                Attr("PK").begins_with(f"{tenant_keys.org_pk(org_id)}#USER#")
                & Attr("SK").eq(tenant_keys.user_sk())
            ),
            Select="COUNT",
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        count += response.get("Count", 0)
    return count


def _record_overflow(r: OverflowReport) -> None:
    """Audit log entry. Actor is a synthetic 'system' identity since this
    runs out of any user context."""
    log.warning(
        "seat-overflow-detected",
        extra={
            "org_id": r.org_id,
            "plan_tier": r.plan_tier,
            "limit": r.seat_limit,
            "actual": r.actual_seats,
            "overflow": r.overflow,
        },
    )
    pseudo_ctx = AuthContext(
        user_id="system:reconciliation",
        email="",
        system_role="OWNER",  # for audit-action permission resolution
        org_id=r.org_id,
    )
    audit.record(
        pseudo_ctx,
        action="plan.seats_overflow",
        target={"type": "plan", "id": r.plan_tier},
        summary=(
            f"Seat usage {r.actual_seats} exceeds {r.plan_tier} limit "
            f"of {r.seat_limit} (over by {r.overflow})"
        ),
        metadata={
            "limit": r.seat_limit,
            "actual": r.actual_seats,
            "overflow": r.overflow,
        },
    )
