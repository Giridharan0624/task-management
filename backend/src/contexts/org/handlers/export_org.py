"""POST /orgs/current/export — generate a tenant data export.

Produces a single JSON file containing every item in the tenant's
partition (org metadata, settings, plan, roles, pipelines, users,
projects, tasks, comments, attendance, day-offs, task updates,
activity, audit log). Uploaded to S3 under
`orgs/{orgId}/exports/{timestamp}.json`, returned as a 24h-TTL
presigned GET URL.

Callable in any state (ACTIVE, SUSPENDED, PENDING_DELETION) so the
owner can always get their data out. Deliberately does NOT call
`require_not_suspended`.

Synchronous limitation: a 5-minute Lambda timeout means this works
for small-to-mid tenants (~tens of thousands of items). Enterprise
tenants will eventually need an async job pattern (queue + S3
multipart + email on completion) — deferred until a real tenant
bumps the limit.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.config import Config as BotoConfig

from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit, tenant_keys
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.dynamo_client import get_table
from shared_kernel.errors import AuthorizationError, NotFoundError
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success

BUCKET = os.environ.get("UPLOADS_BUCKET", "")
REGION = os.environ.get("AWS_REGION", "ap-south-1")
s3_client = boto3.client(
    "s3",
    region_name=REGION,
    config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)

# Two partition shapes to collect:
#   1. `ORG#{org}` — org/settings/plan/roles/pipelines/invites (SKs
#      vary). One query covers the whole config surface.
#   2. `ORG#{org}#*` — users, projects, tasks, etc. live under
#      composite partition keys. We scan by begins_with(PK) to get
#      everything in one pass.
#   3. `ORG#{org}#AUDIT` — audit log on its own partition.
# SLUG#{slug} and INVITE_TOKEN#{token} lookups are deliberately
# EXCLUDED — they're metadata used by cross-cutting handlers, not
# tenant data that the owner authored.


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        if (auth.role_id or auth.system_role).lower() != "owner":
            raise AuthorizationError(
                "Only the workspace owner can export workspace data.",
            )
        require(auth, P.SETTINGS_EDIT)

        repo = OrgDynamoRepository()
        org = repo.find_by_id(auth.org_id)
        if not org:
            raise NotFoundError(f"Organization '{auth.org_id}' not found.")

        table = get_table()
        now = datetime.now(timezone.utc).isoformat()

        # Partition 1: ORG#{org} — single-partition query captures every
        # config row (ORG, SETTINGS, PLAN, ROLE#*, PIPELINE#*, INVITE#*).
        config_items = _query_all(
            table,
            KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(auth.org_id)),
        )

        # Partition 2: all composite partitions ORG#{org}#*. Scan with a
        # begins_with filter — unavoidable because we can't query across
        # partition keys, and the tenant's row count bounds the cost.
        composite_items = _scan_prefix(
            table,
            prefix=f"{tenant_keys.org_pk(auth.org_id)}#",
        )

        # Partition 3: audit log.
        audit_items = _query_all(
            table,
            KeyConditionExpression=Key("PK").eq(
                tenant_keys.audit_pk(auth.org_id)
            ),
        )

        payload = {
            "schema_version": 1,
            "org": org.to_dict(),
            "exported_at": now,
            "exported_by": {"user_id": auth.user_id, "email": auth.email},
            "item_counts": {
                "config": len(config_items),
                "tenant_data": len(composite_items),
                "audit": len(audit_items),
            },
            "config": [_dynamo_to_json(it) for it in config_items],
            "tenant_data": [_dynamo_to_json(it) for it in composite_items],
            "audit": [_dynamo_to_json(it) for it in audit_items],
        }

        ts = now.replace(":", "-").replace(".", "-")
        key = f"orgs/{auth.org_id}/exports/{ts}.json"
        body = json.dumps(payload, default=str)
        s3_client.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
            # Server-side encryption is on at the bucket level; nothing
            # to set here.
        )

        download_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": key},
            ExpiresIn=24 * 3600,  # 24h window to download before re-request
        )

        audit.record(
            auth,
            action="org.exported",
            target={"type": "org", "id": auth.org_id},
            summary=(
                f"Exported workspace data — "
                f"{len(config_items) + len(composite_items) + len(audit_items)} "
                f"items"
            ),
            metadata={"s3_key": key},
        )
        return build_success(200, {
            "download_url": download_url,
            "expires_in_seconds": 24 * 3600,
            "size_bytes": len(body),
            "item_count": (
                len(config_items) + len(composite_items) + len(audit_items)
            ),
        })
    except Exception as e:
        return build_error(e)


def _query_all(table, **kwargs) -> list[dict]:
    """Drain a partition with pagination."""
    items: list[dict] = []
    resp = table.query(**kwargs)
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.query(ExclusiveStartKey=resp["LastEvaluatedKey"], **kwargs)
        items.extend(resp.get("Items", []))
    return items


def _scan_prefix(table, prefix: str) -> list[dict]:
    """Scan for any item whose PK starts with `prefix`. Used for the
    cross-partition sweep (USER#{id}, PROJECT#{id}, etc. under one
    tenant). Costly at large row counts — fine for export, not for
    hot read paths."""
    items: list[dict] = []
    filt = Attr("PK").begins_with(prefix)
    resp = table.scan(FilterExpression=filt)
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.scan(
            FilterExpression=filt,
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        items.extend(resp.get("Items", []))
    return items


def _dynamo_to_json(item: dict) -> dict:
    """Normalize DynamoDB-returned types that json.dumps can't handle
    natively. The boto3 Table resource already unwraps most types
    (Decimal, bytes, sets). We pass them through `default=str` at the
    dump site for anything exotic that slips through."""
    return item
