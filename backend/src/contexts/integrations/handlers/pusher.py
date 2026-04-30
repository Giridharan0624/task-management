"""SQS-triggered: outbound writes from TaskFlow → 3rd-party providers.

Each SQS message has shape:
    { org_id, item_type, item_id, change_type }

The pusher loads every ExternalLink for that item across all providers and
calls each connector's `push_item`. A connector failure for one provider
must not block pushes to other providers for the same item.

This Lambda's contract: never raise. Bad messages → DLQ for inspection.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from contexts.integrations import bootstrap as _bootstrap  # noqa: F401 — registers connectors at cold start
from contexts.integrations.domain.connector_registry import default_registry
from contexts.integrations.domain.entities import OutboxEntry
from contexts.integrations.domain.normalized import ItemPatch
from contexts.integrations.domain.value_objects import IntegrationStatus, ItemType
from contexts.integrations.infrastructure.external_link_repo_dynamo import (
    ExternalLinkDynamoRepository,
)
from contexts.integrations.infrastructure.integration_repo_dynamo import (
    IntegrationDynamoRepository,
)
from contexts.integrations.infrastructure import kms_credentials
from contexts.integrations.infrastructure.outbox_repo_dynamo import (
    OutboxDynamoRepository,
)
from contexts.task.domain.entities import Task
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from shared_kernel.tenant_keys import set_current_org_id


# TaskFlow status → NormalizedItem status (provider-agnostic).
_TASK_TO_NORMAL_STATUS = {
    "TODO": "OPEN",
    "IN_PROGRESS": "PENDING",
    "DONE": "RESOLVED",
}

# TaskFlow priority enum value → NormalizedItem priority.
_TASK_TO_NORMAL_PRIORITY = {
    "LOW": "LOW",
    "MEDIUM": "MEDIUM",
    "HIGH": "HIGH",
}


def _task_to_patch(task: Task) -> ItemPatch:
    return ItemPatch(
        title=task.title,
        description=task.description,
        status=_TASK_TO_NORMAL_STATUS.get(task.status),
        priority=_TASK_TO_NORMAL_PRIORITY.get(task.priority.value if hasattr(task.priority, "value") else str(task.priority)),
        due_at=task.deadline,
    )


log = logging.getLogger(__name__)
log.setLevel(logging.INFO)


def handler(event, context):
    failures: list[dict] = []
    for record in event.get("Records", []):
        try:
            _process_record(record)
        except Exception:
            log.exception("pusher failed for record %s", record.get("messageId"))
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}


def _process_record(record: dict) -> None:
    body = json.loads(record.get("body") or "{}")
    org_id = body.get("org_id")
    item_type_str = body.get("item_type")
    item_id = body.get("item_id")
    if not org_id or not item_type_str or not item_id:
        log.warning("malformed pusher message: %s", record.get("messageId"))
        return

    set_current_org_id(org_id)

    try:
        item_type = ItemType(item_type_str)
    except ValueError:
        log.warning("unknown item_type: %s", item_type_str)
        return

    link_repo = ExternalLinkDynamoRepository(org_id=org_id)
    links = link_repo.find_by_item(item_type, item_id)
    if not links:
        return  # No outbound destinations — silent success.

    integration_repo = IntegrationDynamoRepository(org_id=org_id)
    outbox_repo = OutboxDynamoRepository(org_id=org_id)
    task_repo = TaskDynamoRepository(org_id=org_id)

    task = task_repo.find_by_id(item_id) if item_type == ItemType.TASK else None
    if task is None:
        log.info("pusher: task %s not found; nothing to push", item_id)
        return

    base_patch = _task_to_patch(task)

    for link in links:
        connector = default_registry.try_get(link.provider)
        if connector is None:
            log.info("provider %s no longer registered; skipping", link.provider)
            continue

        integration = integration_repo.find_by_id(link.integration_id)
        if integration is None or integration.status != IntegrationStatus.CONNECTED:
            continue

        patch = ItemPatch(**base_patch.model_dump())

        sync_id = uuid.uuid4().hex
        outbox_repo.put(
            OutboxEntry(
                org_id=org_id,
                integration_id=link.integration_id,
                sync_id=sync_id,
                item_id=item_id,
                expires_at_epoch=0,
            ),
            ttl_seconds=300,
        )
        patch = connector.stamp_outbound(patch, sync_id)

        try:
            creds = kms_credentials.decrypt(
                integration.encrypted_credentials,
                kms_credentials.encryption_context(
                    org_id=org_id,
                    integration_id=integration.integration_id,
                    provider=integration.provider,
                ),
            )
        except Exception:
            log.exception("KMS decrypt failed for integration %s", integration.integration_id)
            integration.status = IntegrationStatus.NEEDS_REAUTH
            integration_repo.update(integration)
            continue

        try:
            result = connector.push_item(creds, link, patch)
        except Exception:
            log.exception("push_item failed for %s/%s", link.provider, link.external_id)
            continue

        if result.success:
            link.last_pushed_at = datetime.now(timezone.utc).isoformat()
            link.etag = result.etag or link.etag
            link_repo.update(link)
        else:
            log.warning(
                "push_item returned failure for %s/%s: %s",
                link.provider,
                link.external_id,
                result.error,
            )
            if result.error == "auth_failed":
                integration.status = IntegrationStatus.NEEDS_REAUTH
                integration.last_error = "Push rejected — credentials need re-authentication"
                integration_repo.update(integration)
