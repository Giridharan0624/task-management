"""Loop-prevention helper. The pusher writes a sync_id to the outbox right
before pushing; the sync_worker checks the outbox before processing inbound.

This module wraps the platform-side bookkeeping. Each connector decides how to
*find* its sync_id inside an inbound payload via `Connector.detect_echo`.
"""
from __future__ import annotations

import logging
import uuid

from contexts.integrations.domain.entities import OutboxEntry
from contexts.integrations.domain.repository import IOutboxRepository


log = logging.getLogger(__name__)


def stamp_outbound(
    *,
    org_id: str,
    integration_id: str,
    item_id: str,
    repo: IOutboxRepository,
    ttl_seconds: int = 300,
) -> str:
    """Record a fresh sync_id in the outbox so an inbound webhook carrying it
    can be detected as our own echo and dropped."""
    sync_id = uuid.uuid4().hex
    repo.put(
        OutboxEntry(
            org_id=org_id,
            integration_id=integration_id,
            sync_id=sync_id,
            item_id=item_id,
            expires_at_epoch=0,
        ),
        ttl_seconds=ttl_seconds,
    )
    return sync_id


def is_recent_echo(
    *,
    integration_id: str,
    sync_id: str,
    repo: IOutboxRepository,
) -> bool:
    """True when the inbound carries a sync_id we wrote in the last few minutes."""
    return repo.find(integration_id, sync_id) is not None
