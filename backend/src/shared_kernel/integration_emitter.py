"""Best-effort outbound emitter for the integration platform.

Existing handlers (task / project / comment write paths) call
`emit_item_changed(...)` exactly once at the end of a successful write. The
emitter is provider-agnostic — existing handlers know nothing about Freshworks
or any other connector.

CRITICAL CONTRACT
-----------------
This function MUST NOT raise. Any exception is swallowed and logged. If the
queue is missing, the flag service is down, KMS is broken, or the SQS quota is
exhausted, the existing user-facing operation that called this MUST still
succeed. The integration is a best-effort overlay, not a load-bearing
dependency.

If you are about to add `raise` anywhere in this module, stop — that violates
the additivity contract documented in
docs/planning/INTEGRATION-PLATFORM-PLAN.md section 1.5.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import boto3


_log = logging.getLogger(__name__)
_sqs_client: Optional[object] = None


def _sqs():
    global _sqs_client
    if _sqs_client is None:
        _sqs_client = boto3.client("sqs", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _sqs_client


def emit_item_changed(
    org_id: str,
    item_type: str,
    item_id: str,
    change_type: str = "UPDATED",
) -> None:
    """Notify the integration platform that a TaskFlow item changed.

    No-op when:
      - the integration platform is not deployed in this stage (no queue URL),
      - no integrations exist for the org (cheap flag check is skipped here
        and offloaded to the pusher Lambda — keeping the hot path zero-cost
        means we accept some empty SQS messages).

    Returns None always. Never raises.
    """
    try:
        queue_url = os.environ.get("INTEGRATIONS_OUTBOUND_QUEUE_URL")
        if not queue_url:
            return
        _sqs().send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(
                {
                    "org_id": org_id,
                    "item_type": item_type,
                    "item_id": item_id,
                    "change_type": change_type,
                }
            ),
        )
    except Exception:
        _log.warning(
            "integration_emitter: emit failed for org=%s item=%s/%s; ignoring",
            org_id,
            item_type,
            item_id,
            exc_info=True,
        )
