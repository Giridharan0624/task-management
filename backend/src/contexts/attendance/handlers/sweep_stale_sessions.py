"""Scheduled Lambda — closes attendance sessions abandoned by the client.

Triggered by an EventBridge rule (every 5 minutes in staging/prod).
No JWT; invokes the per-tenant sweep as a system-level actor.

Grace window is 15 minutes by default (3× the 5-minute client
heartbeat cadence). Override via the STALE_SESSION_GRACE_MINUTES env
var so staging can tune faster without touching code.

Scope of damage limit: even if this function misbehaves it can only
call attendance.sign_out, which is idempotent on already-closed
sessions. The worst pathological case is "closes a user's session
slightly earlier than they'd like"; it cannot corrupt data or
reopen closed sessions.

See internal/updater pattern at auto_generate_summaries.py for the
orgs-iteration approach.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from contexts.attendance.application.sweep_use_case import (
    SweepResult,
    SweepStaleSessionsUseCase,
)
from contexts.attendance.infrastructure.dynamo_repository import AttendanceDynamoRepository
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DEFAULT_GRACE_MINUTES = 15


def _grace_minutes() -> int:
    raw = os.environ.get("STALE_SESSION_GRACE_MINUTES", "").strip()
    if not raw:
        return DEFAULT_GRACE_MINUTES
    try:
        value = int(raw)
    except ValueError:
        logger.warning(
            "sweep: STALE_SESSION_GRACE_MINUTES=%r is not an integer — "
            "falling back to default %d",
            raw,
            DEFAULT_GRACE_MINUTES,
        )
        return DEFAULT_GRACE_MINUTES
    # Never less than 5 minutes — at that threshold normal heartbeat
    # jitter would trip the sweep on every run. Cap at 1 day to stop
    # a typo from turning the sweeper into a no-op forever.
    return max(5, min(value, 1440))


def handler(event, context):
    now = datetime.now(timezone.utc)
    grace = _grace_minutes()
    logger.info("sweep: starting now=%s grace_minutes=%d", now.isoformat(), grace)

    org_repo = OrgDynamoRepository()
    try:
        orgs = org_repo.list_all_orgs()
    except Exception as exc:
        logger.error("sweep: list_all_orgs failed: %s", exc)
        raise

    total = SweepResult()
    total.orgs_processed = len(orgs)
    per_org: list[dict] = []

    for org in orgs:
        try:
            repo = AttendanceDynamoRepository(org_id=org.org_id)
            use_case = SweepStaleSessionsUseCase(repo)
            result = use_case.execute(now=now, grace_minutes=grace)
            total.sessions_inspected += result.sessions_inspected
            total.sessions_closed += result.sessions_closed
            total.errors += result.errors
            per_org.append({"org_id": org.org_id, **result.as_dict()})
            if result.sessions_closed > 0:
                logger.info(
                    "sweep: org=%s closed=%d inspected=%d errors=%d",
                    org.org_id,
                    result.sessions_closed,
                    result.sessions_inspected,
                    result.errors,
                )
        except Exception as exc:
            logger.error("sweep: org=%s failed: %s", org.org_id, exc)
            total.errors += 1
            per_org.append({"org_id": org.org_id, "error": str(exc)})

    logger.info(
        "sweep: done orgs=%d inspected=%d closed=%d errors=%d",
        total.orgs_processed,
        total.sessions_inspected,
        total.sessions_closed,
        total.errors,
    )
    return {
        **total.as_dict(),
        "per_org": per_org,
    }
