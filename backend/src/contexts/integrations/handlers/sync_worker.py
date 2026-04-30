"""SQS-triggered: reconcile inbound webhook events against the provider's REST
API and upsert into TaskFlow.

Each SQS message has shape:
    { provider, org_id, integration_id, event_id, normalized: {NormalizedEvent} }

The platform path is provider-agnostic — provider-specific work happens inside
`connector.fetch_item` and the inbound mapping (Phase 1b for Freshworks).

This Lambda's contract: never raise. SQS retries are bounded, after which the
message lands in the DLQ for human inspection. A failed sync MUST NOT impact
any other tenant or any non-integration code path.
"""
from __future__ import annotations

import json
import logging

from contexts.integrations import bootstrap as _bootstrap  # noqa: F401 — registers connectors at cold start
from contexts.integrations.application.resolve_assignee import resolve_assignee
from contexts.integrations.application.upsert_task_from_external import (
    upsert_task_from_external,
)
from contexts.integrations.domain.connector_registry import default_registry
from contexts.integrations.domain.normalized import NormalizedEvent, NormalizedItem
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
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.tenant_keys import set_current_org_id


log = logging.getLogger(__name__)
log.setLevel(logging.INFO)


def handler(event, context):
    """SQS event source. Returns a list of failed message IDs so the runtime
    only retries the bad ones (partial-batch response)."""
    failures: list[dict] = []
    for record in event.get("Records", []):
        try:
            _process_record(record)
        except Exception:
            log.exception("sync_worker failed processing record %s", record.get("messageId"))
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}


def _process_record(record: dict) -> None:
    body = json.loads(record.get("body") or "{}")
    provider = body.get("provider")
    org_id = body.get("org_id")
    integration_id = body.get("integration_id")
    if not provider or not org_id or not integration_id:
        log.warning("malformed sync record: %s", record.get("messageId"))
        return

    set_current_org_id(org_id)

    connector = default_registry.try_get(provider)
    if connector is None:
        log.warning("unknown provider in sync queue: %s", provider)
        return

    integration_repo = IntegrationDynamoRepository(org_id=org_id)
    integration = integration_repo.find_by_id(integration_id)
    if integration is None:
        log.info("integration %s no longer exists; dropping event", integration_id)
        return

    normalized_event = NormalizedEvent(**body.get("normalized", {}))

    creds = kms_credentials.decrypt(
        integration.encrypted_credentials,
        kms_credentials.encryption_context(
            org_id=org_id, integration_id=integration_id, provider=provider
        ),
    )

    item: NormalizedItem = connector.fetch_item(creds, normalized_event.external_id)

    outbox_repo = OutboxDynamoRepository(org_id=org_id)
    outbox_ids = _collect_outbox_ids(outbox_repo, integration_id, item)
    if outbox_ids and connector.detect_echo(item, outbox_ids):
        log.info("dropping echo of our own outbound write for %s", item.external_id)
        return

    link_repo = ExternalLinkDynamoRepository(org_id=org_id)
    task_repo = TaskDynamoRepository(org_id=org_id)
    user_repo = UserDynamoRepository(org_id=org_id)

    def _resolve(*, integration, agent_email):
        return resolve_assignee(
            integration=integration,
            agent_email=agent_email,
            user_repo=user_repo,
        )

    task, created = upsert_task_from_external(
        integration=integration,
        item=item,
        agent_email=item.assignee_email,
        task_repo=task_repo,
        link_repo=link_repo,
        resolve_assignee=_resolve,
    )
    log.info(
        "%s TaskFlow task %s for external %s",
        "created" if created else "updated",
        task.task_id,
        item.external_id,
    )


def _collect_outbox_ids(repo: OutboxDynamoRepository, integration_id: str, item: NormalizedItem) -> set[str]:
    """A connector embeds its sync_id in `item.metadata` under a known key it
    chose. We pull it back out generically without knowing the field name —
    just look for a metadata value named '*sync_id*'."""
    candidates: set[str] = set()
    for key, value in (item.metadata or {}).items():
        if "sync_id" in key.lower() and isinstance(value, str):
            entry = repo.find(integration_id, value)
            if entry is not None:
                candidates.add(value)
    return candidates
