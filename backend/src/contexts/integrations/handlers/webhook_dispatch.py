"""Generic webhook dispatcher.

Route: POST /integrations/{provider}/webhook/{org_id}/{integration_id}

This Lambda is INTENTIONALLY UN-AUTHENTICATED via Cognito. The 3rd-party
provider (Freshdesk, Slack, Jira, ...) calls it directly. Authentication is
performed by:
  1. Bearer secret comparison against the SHA-256 hash stored on the
     Integration record at connect time, AND
  2. provider-specific signature verification inside the connector (HMAC,
     RSA, etc.) via `connector.parse_webhook` raising on bad signatures.

Hot-path requirements:
  - Return 200 within ~200ms. Heavy work is offloaded to SQS.
  - Never raise to the caller — providers retry aggressively on 5xx and
     having a noisy webhook hammer our API GW would be a self-DoS.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone

import boto3

from contexts.integrations.domain.connector_registry import default_registry
from contexts.integrations.domain.entities import SyncEvent
from contexts.integrations.infrastructure.integration_repo_dynamo import (
    IntegrationDynamoRepository,
)
from contexts.integrations.infrastructure.sync_event_repo_dynamo import (
    SyncEventDynamoRepository,
)
from shared_kernel.tenant_keys import set_current_org_id


_sqs = boto3.client("sqs", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def handler(event, context):
    started = time.monotonic()
    try:
        path_params = event.get("pathParameters") or {}
        provider = path_params.get("provider")
        org_id = path_params.get("org_id")
        integration_id = path_params.get("integration_id")
        if not provider or not org_id or not integration_id:
            return _response(400, {"error": "missing path parameters"})

        set_current_org_id(org_id)

        connector = default_registry.try_get(provider)
        if connector is None:
            return _response(404, {"error": "unknown provider"})

        repo = IntegrationDynamoRepository(org_id=org_id)
        integration = repo.find_by_id(integration_id)
        if integration is None or integration.org_id != org_id:
            return _response(404, {"error": "unknown integration"})
        if integration.provider != provider:
            return _response(404, {"error": "provider/integration mismatch"})

        headers_in = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        bearer = _extract_bearer(headers_in)
        bearer_ok = bearer is not None and (
            hashlib.sha256(bearer.encode("utf-8")).hexdigest() == integration.webhook_secret_hash
        )

        body_text = event.get("body") or ""
        if event.get("isBase64Encoded"):
            import base64

            body_bytes = base64.b64decode(body_text)
        else:
            body_bytes = body_text.encode("utf-8")

        event_id = uuid.uuid4().hex
        received_at = datetime.now(timezone.utc).isoformat()

        SyncEventDynamoRepository(org_id=org_id).save(
            SyncEvent(
                org_id=org_id,
                integration_id=integration_id,
                event_id=event_id,
                received_at=received_at,
                raw_headers={k: str(v) for k, v in headers_in.items()},
                raw_body=body_text,
                bearer_verified=bearer_ok,
                enqueued=False,
            )
        )

        if not bearer_ok:
            return _response(401, {"error": "invalid webhook secret"})

        try:
            normalized = connector.parse_webhook(headers_in, body_bytes)
        except Exception:
            return _response(202, {"status": "accepted_but_unparseable"})

        if normalized is None:
            return _response(200, {"status": "ignored"})

        normalized.integration_id = integration_id

        queue_url = os.environ.get("INTEGRATIONS_SYNC_QUEUE_URL")
        if not queue_url:
            return _response(503, {"error": "sync queue not configured"})

        _sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(
                {
                    "provider": provider,
                    "org_id": org_id,
                    "integration_id": integration_id,
                    "event_id": event_id,
                    "normalized": normalized.model_dump(mode="json"),
                }
            ),
        )

        elapsed_ms = int((time.monotonic() - started) * 1000)
        return _response(200, {"status": "queued", "event_id": event_id, "elapsed_ms": elapsed_ms})

    except Exception:
        return _response(503, {"error": "transient_failure_retry"})


def _extract_bearer(headers: dict[str, str]) -> str | None:
    auth = headers.get("authorization") or headers.get("Authorization")
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return auth.strip()
