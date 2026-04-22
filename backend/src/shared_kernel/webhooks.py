"""Outbound webhooks — CRUD helpers + HMAC-signed sync delivery.

MVP scope:
  - Tenants register webhook URLs via CRUD endpoints; each endpoint
    subscribes to a set of event types (`task.created`,
    `task.assigned`, `dayoff.approved`, ...).
  - When a handler emits an event via `deliver(org_id, event, payload)`,
    every registered webhook matching that event type gets a POST
    request with an HMAC-SHA256 signature header.
  - Sync delivery — no SQS / retry queue in v1. A 4xx or network
    failure is logged and dropped. Subscribers must tolerate missed
    events (reconcile via API). A future session can wire a proper
    retry queue once we have a real tenant relying on exactly-once.

Storage:
    PK = ORG#{org_id}                       # same partition as settings
    SK = WEBHOOK#{webhook_id}

Attributes:
    webhook_id, url, secret, events[], description, enabled,
    created_at, updated_at

`secret` is a per-webhook random string used to sign the HMAC. Returned
in full ONLY on the first create-response; subsequent reads return a
masked preview so it can't leak via UI inspection.

Signature: `X-TaskFlow-Signature: t={ts},v1={hmac_hex}`
    ts is unix seconds, hmac_hex is HMAC_SHA256(secret, `{ts}.{body}`)
    — same shape as Stripe's webhook signing so subscriber libraries
    written against Stripe work with minimal tweaks.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from boto3.dynamodb.conditions import Key

from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table

log = logging.getLogger("taskflow.webhooks")

_DELIVERY_TIMEOUT_SECONDS = 5
_USER_AGENT = "TaskFlow-Webhook/1.0"


# Event constants — keep in sync with emitters.
TASK_CREATED = "task.created"
TASK_ASSIGNED = "task.assigned"
TASK_COMPLETED = "task.completed"
DAYOFF_REQUESTED = "dayoff.requested"
DAYOFF_APPROVED = "dayoff.approved"
DAYOFF_REJECTED = "dayoff.rejected"
USER_INVITED = "user.invited"
USER_CREATED = "user.created"

ALL_EVENT_TYPES = frozenset({
    TASK_CREATED, TASK_ASSIGNED, TASK_COMPLETED,
    DAYOFF_REQUESTED, DAYOFF_APPROVED, DAYOFF_REJECTED,
    USER_INVITED, USER_CREATED,
})


# ─── CRUD ────────────────────────────────────────────────────────────


def create(
    org_id: str,
    *,
    url: str,
    events: list[str],
    description: str = "",
) -> dict:
    webhook_id = uuid.uuid4().hex[:12]
    # 32 random bytes urlsafe-encoded → ~43 char secret. Stored in
    # plaintext because we need to recompute HMACs on every delivery;
    # the secret is only usable within our own Lambda so there's no
    # benefit to hashing (unlike user passwords).
    secret = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    normalized_events = _normalize_events(events)

    item = {
        "PK": tenant_keys.org_pk(org_id),
        "SK": tenant_keys.webhook_sk(webhook_id),
        "org_id": org_id,
        "webhook_id": webhook_id,
        "url": url,
        "secret": secret,
        "events": normalized_events,
        "description": description,
        "enabled": True,
        "created_at": now,
        "updated_at": now,
    }
    get_table().put_item(Item=item)
    # First-create response is the only time the full secret is
    # returned — subsequent reads mask it.
    return _to_public_dict(item, reveal_secret=True)


def update(
    org_id: str,
    webhook_id: str,
    *,
    url: Optional[str] = None,
    events: Optional[list[str]] = None,
    description: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> Optional[dict]:
    existing = get_table().get_item(
        Key={
            "PK": tenant_keys.org_pk(org_id),
            "SK": tenant_keys.webhook_sk(webhook_id),
        }
    ).get("Item")
    if not existing:
        return None

    updates: dict[str, Any] = {}
    if url is not None:
        updates["url"] = url
    if events is not None:
        updates["events"] = _normalize_events(events)
    if description is not None:
        updates["description"] = description
    if enabled is not None:
        updates["enabled"] = bool(enabled)
    if not updates:
        return _to_public_dict(existing)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    merged = {**existing, **updates}
    get_table().put_item(Item=merged)
    return _to_public_dict(merged)


def delete(org_id: str, webhook_id: str) -> bool:
    get_table().delete_item(
        Key={
            "PK": tenant_keys.org_pk(org_id),
            "SK": tenant_keys.webhook_sk(webhook_id),
        }
    )
    return True


def list_for_org(org_id: str) -> list[dict]:
    resp = get_table().query(
        KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(org_id))
        & Key("SK").begins_with("WEBHOOK#"),
    )
    return [_to_public_dict(it) for it in resp.get("Items", [])]


def _list_internal(org_id: str) -> list[dict]:
    """Same as list_for_org but returns the raw items (with secret)
    so `deliver()` can sign requests."""
    resp = get_table().query(
        KeyConditionExpression=Key("PK").eq(tenant_keys.org_pk(org_id))
        & Key("SK").begins_with("WEBHOOK#"),
    )
    return resp.get("Items", [])


# ─── Delivery ────────────────────────────────────────────────────────


def deliver(org_id: str, event: str, payload: dict) -> None:
    """Fire every matching webhook synchronously. Never raises — a
    misbehaving subscriber URL should not break the primary action.

    Delivery is best-effort on a 5-second timeout. 2xx = success;
    anything else is logged and dropped. Subscribers that need
    guaranteed delivery must reconcile via API.
    """
    if not org_id or not event:
        return
    try:
        webhooks = _list_internal(org_id)
    except Exception as e:
        log.warning("webhook-list-failed: %s", e)
        return

    body_dict = {
        "event": event,
        "org_id": org_id,
        "data": payload,
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }
    body_bytes = json.dumps(body_dict, default=str).encode("utf-8")

    for wh in webhooks:
        if not wh.get("enabled", True):
            continue
        subscribed_events = wh.get("events") or []
        if event not in subscribed_events and "*" not in subscribed_events:
            continue
        try:
            _send(wh, body_bytes)
        except Exception as e:
            # Per-webhook failure isolated from siblings; log + move on.
            log.warning(
                "webhook-delivery-failed url=%s event=%s err=%s",
                wh.get("url"), event, e,
            )


def _send(webhook: dict, body: bytes) -> None:
    ts = str(int(time.time()))
    mac = hmac.new(
        key=webhook["secret"].encode("utf-8"),
        msg=f"{ts}.".encode("utf-8") + body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    signature = f"t={ts},v1={mac}"

    req = urllib.request.Request(
        webhook["url"],
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": _USER_AGENT,
            "X-TaskFlow-Signature": signature,
            "X-TaskFlow-Webhook-Id": webhook["webhook_id"],
        },
    )
    with urllib.request.urlopen(req, timeout=_DELIVERY_TIMEOUT_SECONDS) as resp:
        if not (200 <= resp.status < 300):
            raise RuntimeError(f"Subscriber returned {resp.status}")


def _normalize_events(events: list[str]) -> list[str]:
    """Drop duplicates + keep only known event types or the wildcard
    `*`. Unknown strings silently dropped — avoids typos stealth-
    subscribing to nothing."""
    out = []
    seen: set[str] = set()
    for e in events or []:
        if e == "*" or e in ALL_EVENT_TYPES:
            if e not in seen:
                out.append(e)
                seen.add(e)
    return out or ["*"]


def _to_public_dict(item: dict, *, reveal_secret: bool = False) -> dict:
    """Mask the secret on list/get responses — only the first create
    response returns it in full. `events` is stored as a list of
    strings in DDB; boto3 may return a set for some types, so we
    sort on read for stable ordering."""
    raw_secret = item.get("secret", "")
    if reveal_secret:
        shown_secret = raw_secret
    else:
        # Reveal first 4 + last 4 chars only. Enough for the UI to
        # show a recognisable stub without exposing the material.
        if len(raw_secret) > 12:
            shown_secret = f"{raw_secret[:4]}…{raw_secret[-4:]}"
        else:
            shown_secret = "…"
    events = item.get("events") or []
    if not isinstance(events, list):
        events = list(events)
    return {
        "webhook_id": item.get("webhook_id"),
        "url": item.get("url"),
        "description": item.get("description", ""),
        "events": sorted(events),
        "enabled": bool(item.get("enabled", True)),
        "secret_preview": shown_secret,
        "secret": raw_secret if reveal_secret else None,
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }
