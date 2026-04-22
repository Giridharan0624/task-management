"""Nightly Lambda — physically delete orgs past the 30-day grace.

Runs once a day (04:00 UTC, right after the retention sweeper and seat
reconciliation windows). Finds tenants with `status=PENDING_DELETION`
and `deleted_at < now - 30d`, then wipes every tenant-scoped row plus
the slug resolver plus every Cognito user that belonged to the org.

Hard-deletion is unconditional and non-recoverable. PITR can restore
the DynamoDB table to a pre-sweep point in time, but Cognito has no
equivalent — once `admin_delete_user` lands, that email can be
re-registered by anyone.

Safety rails:
  - Requires status==PENDING_DELETION AND deleted_at set AND past
    grace period (belt-and-suspenders triple check)
  - Captures user emails from DDB before deleting DDB rows, so a
    mid-sweep failure doesn't orphan Cognito users
  - `GRACE_DAYS` is configurable via env (defaults to 30) for staging
    rehearsals with a compressed timeline
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import boto3
from boto3.dynamodb.conditions import Attr, Key

from contexts.org.domain.value_objects import OrgStatus
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table

log = logging.getLogger("taskflow.hard_delete_sweeper")
log.setLevel(logging.INFO)

GRACE_DAYS = int(os.environ.get("HARD_DELETE_GRACE_DAYS", "30"))
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")

cognito = boto3.client(
    "cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"),
)


def handler(event, context):
    """Scheduled entry point. Returns a summary dict for CloudWatch
    visibility."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=GRACE_DAYS)
    log.info(
        "sweeper-start grace_days=%d cutoff=%s", GRACE_DAYS, cutoff.isoformat(),
    )

    repo = OrgDynamoRepository()
    try:
        orgs = repo.list_all_orgs()
    except Exception as e:
        log.exception("sweeper-list-failed: %s", e)
        return {"purged": 0, "errors": ["list_all_orgs failed"]}

    purged = 0
    errors: list[str] = []

    for org in orgs:
        if org.status != OrgStatus.PENDING_DELETION:
            continue
        if not org.deleted_at:
            # Status says pending but no timestamp — data corruption.
            # Skip to avoid mis-deleting; operator should inspect.
            log.warning(
                "sweeper-skip-no-timestamp org_id=%s", org.org_id,
            )
            continue
        try:
            deleted_dt = datetime.fromisoformat(
                org.deleted_at.replace("Z", "+00:00"),
            )
        except ValueError:
            log.warning(
                "sweeper-skip-bad-timestamp org_id=%s deleted_at=%s",
                org.org_id, org.deleted_at,
            )
            continue
        if deleted_dt > cutoff:
            # Still in grace period.
            continue

        try:
            _purge_org(org.org_id, org.slug)
            purged += 1
            log.info(
                "sweeper-purged org_id=%s slug=%s deleted_at=%s",
                org.org_id, org.slug, org.deleted_at,
            )
        except Exception as e:
            log.exception("sweeper-purge-failed org_id=%s: %s", org.org_id, e)
            errors.append(f"{org.org_id}: {e}")

    summary = {
        "purged": purged,
        "errors": errors,
        "cutoff": cutoff.isoformat(),
    }
    log.info("sweeper-done summary=%s", summary)
    return summary


def _purge_org(org_id: str, slug: str) -> None:
    """Hard-delete every trace of a tenant.

    Order matters: capture the Cognito user emails BEFORE we delete
    the USER#{id} rows, because that's the only map we have from
    org → Cognito identity.
    """
    table = get_table()

    # 1. Grab the emails of every Cognito user in this org so we can
    #    delete them after the DDB rows are gone.
    emails = _collect_user_emails(table, org_id)

    # 2. Delete composite-partition rows: USER#{}, PROJECT#{}, etc.
    prefix = f"{tenant_keys.org_pk(org_id)}#"
    _delete_by_pk_prefix(table, prefix)

    # 3. Delete the config partition ORG#{org_id} (ORG, SETTINGS, PLAN,
    #    ROLE#*, PIPELINE#*, INVITE#*).
    _delete_by_exact_pk(table, tenant_keys.org_pk(org_id))

    # 4. Delete the audit log partition.
    _delete_by_exact_pk(table, tenant_keys.audit_pk(org_id))

    # 5. Delete the slug resolver (global row) so the slug can be
    #    reclaimed by a future signup.
    table.delete_item(
        Key={
            "PK": tenant_keys.slug_pk(slug),
            "SK": tenant_keys.slug_sk(),
        }
    )

    # 6. Delete the Cognito users. Best-effort per user — a failure
    #    here doesn't fail the sweep of other orgs; just logs and
    #    continues.
    if USER_POOL_ID:
        for email in emails:
            try:
                cognito.admin_delete_user(
                    UserPoolId=USER_POOL_ID, Username=email,
                )
            except cognito.exceptions.UserNotFoundException:
                pass  # already gone — idempotent
            except Exception as e:
                log.warning(
                    "sweeper-cognito-delete-failed email=%s err=%s", email, e,
                )


def _collect_user_emails(table, org_id: str) -> list[str]:
    prefix = f"{tenant_keys.org_pk(org_id)}#USER#"
    filt = Attr("PK").begins_with(prefix) & Attr("SK").eq("PROFILE")
    emails: list[str] = []
    resp = table.scan(FilterExpression=filt)
    for item in resp.get("Items", []):
        email = item.get("email")
        if email:
            emails.append(email)
    while "LastEvaluatedKey" in resp:
        resp = table.scan(
            FilterExpression=filt,
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        for item in resp.get("Items", []):
            email = item.get("email")
            if email:
                emails.append(email)
    return emails


def _delete_by_pk_prefix(table, prefix: str) -> None:
    """Scan for every item whose PK begins with `prefix` and batch-
    delete. Uses `batch_writer` so it paginates internally and
    retries unprocessed items."""
    filt = Attr("PK").begins_with(prefix)
    with table.batch_writer() as batch:
        resp = table.scan(
            FilterExpression=filt,
            ProjectionExpression="PK, SK",
        )
        for item in resp.get("Items", []):
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
        while "LastEvaluatedKey" in resp:
            resp = table.scan(
                FilterExpression=filt,
                ProjectionExpression="PK, SK",
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            for item in resp.get("Items", []):
                batch.delete_item(
                    Key={"PK": item["PK"], "SK": item["SK"]},
                )


def _delete_by_exact_pk(table, pk: str) -> None:
    """Drain every SK under a fixed PK via query + batch-delete."""
    with table.batch_writer() as batch:
        resp = table.query(
            KeyConditionExpression=Key("PK").eq(pk),
            ProjectionExpression="PK, SK",
        )
        for item in resp.get("Items", []):
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
        while "LastEvaluatedKey" in resp:
            resp = table.query(
                KeyConditionExpression=Key("PK").eq(pk),
                ProjectionExpression="PK, SK",
                ExclusiveStartKey=resp["LastEvaluatedKey"],
            )
            for item in resp.get("Items", []):
                batch.delete_item(
                    Key={"PK": item["PK"], "SK": item["SK"]},
                )
