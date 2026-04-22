"""Nightly retention sweeper — deletes activity heartbeats older than the
tenant's `plan.retention_days`.

Run on a schedule (EventBridge rule, daily at 03:00 UTC). Iterates every
org in the table, looks up its Plan, computes the cutoff date, and
deletes any ACTIVITY records older than that.

Not yet wired to a CloudWatch event in CDK — the EventBridge rule + the
Lambda function are both new resources, and the stack is at 494/500. The
nested-stack refactor opens the door. Until then this handler is dead
code that the next deploy can wire up in 5 minutes.

Safety properties:
  - Idempotent: deleting an already-deleted item is a no-op.
  - Per-org error isolation: a failure on Org A doesn't stop Org B.
  - Plan-aware: ENTERPRISE (retention_days=None) is skipped.
  - Bounded scan: pages through results, deletes in batches of 25
    (DDB BatchWriteItem cap).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from boto3.dynamodb.conditions import Attr, Key

from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table

log = logging.getLogger("taskflow.retention")
log.setLevel(logging.INFO)


def handler(event, context):
    """Scheduled entry point. Returns a per-org summary for CloudWatch
    Logs (and any future Step-Functions wrapper)."""
    org_repo = OrgDynamoRepository()
    orgs = org_repo.list_all_orgs()

    summary: dict[str, Any] = {
        "orgs_scanned": 0,
        "orgs_skipped_unlimited": 0,
        "orgs_failed": 0,
        "items_deleted": 0,
        "errors": [],
    }

    for org in orgs:
        summary["orgs_scanned"] += 1
        try:
            plan = org_repo.get_plan(org.org_id)
            if plan is None or plan.retention_days is None:
                summary["orgs_skipped_unlimited"] += 1
                continue
            cutoff = (
                datetime.now(timezone.utc) - timedelta(days=plan.retention_days)
            ).strftime("%Y-%m-%d")
            deleted = _sweep_org(org.org_id, cutoff)
            summary["items_deleted"] += deleted
            if deleted:
                log.info(
                    "retention-swept",
                    extra={
                        "org_id": org.org_id,
                        "cutoff": cutoff,
                        "deleted": deleted,
                    },
                )
        except Exception as e:
            summary["orgs_failed"] += 1
            summary["errors"].append({"org_id": org.org_id, "error": str(e)[:200]})

    return summary


def _sweep_org(org_id: str, cutoff_date: str) -> int:
    """Delete all ACTIVITY items in this org with SK earlier than cutoff."""
    table = get_table()

    # ACTIVITY SKs look like ACTIVITY#YYYY-MM-DD — lexicographic compare
    # on the date portion is identical to chronological compare.
    cutoff_sk = tenant_keys.activity_sk(cutoff_date)

    # Scan the org partition for ACTIVITY items older than cutoff. Items
    # are partitioned per-user under PK=ORG#{org}#USER#{uid}, so we scan
    # the whole table filtered to this org. Yes, this is a scan — but
    # nightly + per-tenant batches keep it bounded.
    paginator_kwargs: dict[str, Any] = {
        "FilterExpression": (
            Attr("PK").begins_with(f"{tenant_keys.org_pk(org_id)}#USER#")
            & Attr("SK").begins_with("ACTIVITY#")
            & Attr("SK").lt(cutoff_sk)
        ),
    }

    deleted = 0
    response = table.scan(**paginator_kwargs)
    while True:
        items = response.get("Items", [])
        if items:
            deleted += _batch_delete(table, items)
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        response = table.scan(ExclusiveStartKey=last_key, **paginator_kwargs)
    return deleted


def _batch_delete(table, items: list[dict]) -> int:
    """Delete `items` using the BatchWriter (chunks at 25 internally)."""
    count = 0
    with table.batch_writer() as batch:
        for it in items:
            try:
                batch.delete_item(Key={"PK": it["PK"], "SK": it["SK"]})
                count += 1
            except Exception as e:
                log.warning("retention-delete-failed", extra={
                    "pk": it.get("PK"), "sk": it.get("SK"), "error": str(e)[:200]
                })
    return count
