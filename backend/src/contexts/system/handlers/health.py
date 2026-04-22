"""GET /health — unauthenticated liveness + readiness probe.

Returns 200 when the Lambda itself is reachable and can describe the
DynamoDB table. Returns 503 when DynamoDB is unreachable or the table
is missing — the only downstream this endpoint bothers to check,
because if DDB is down nothing else in the API works anyway.

Response shape:
    {
        "status": "ok" | "degraded",
        "version": "<git-sha or 'unknown'>",
        "checks": {"dynamodb": "ok" | "<error>"},
        "timestamp": "<iso-utc>"
    }

Kept intentionally minimal — no Cognito call (adds cost per probe, a
dead user-pool never happens independently of a broken API Gateway
config which this endpoint would never be reached through anyway).
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from shared_kernel.dynamo_client import get_table
from shared_kernel.response import CORS_HEADERS


def handler(event, context):
    checks = {}

    try:
        # describe_table is lighter than a scan/query and doesn't consume
        # RCUs. Purely a reachability + permission probe.
        get_table().meta.client.describe_table(TableName=get_table().table_name)
        checks["dynamodb"] = "ok"
        ddb_ok = True
    except Exception as e:
        checks["dynamodb"] = f"error: {type(e).__name__}"
        ddb_ok = False

    body = {
        "status": "ok" if ddb_ok else "degraded",
        "version": os.environ.get("GIT_SHA", "unknown"),
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return {
        "statusCode": 200 if ddb_ok else 503,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }
