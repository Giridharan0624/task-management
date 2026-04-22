"""In-app notifications — fire-and-forget writer + reader.

Lives in `shared_kernel` because every context can emit notifications
(tasks, day-offs, comments, etc.) and they all land in the same
partition-per-user storage. Writes are best-effort so a notification
failure never breaks the primary action — same philosophy as the
audit log.

Schema:
    PK = ORG#{org_id}#USER#{user_id}      # per-user partition
    SK = NOTIF#{iso_timestamp}#{notif_id}  # reverse-chron by TS

Attributes:
    notif_id, type, title, message, link,
    created_at, read_at (absent until marked read)

`type` is a free-form string (`task.assigned`, `dayoff.approved`,
`mention`, `system`...). Frontend uses it to branch icons/colors.

There's no cross-tenant leakage: every notification PK carries the
org_id prefix, so a query scoped to the caller's org via the
ContextVar-backed tenant_keys helpers cannot reach another tenant's
partition.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from boto3.dynamodb.conditions import Key

from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table

log = logging.getLogger("taskflow.notifications")


# Action constants — keep in sync with frontend branches.
TASK_ASSIGNED = "task.assigned"
TASK_COMPLETED = "task.completed"
TASK_MENTIONED = "task.mentioned"
DAYOFF_APPROVED = "dayoff.approved"
DAYOFF_REJECTED = "dayoff.rejected"
INVITE_ACCEPTED = "invite.accepted"
SYSTEM = "system"


def _notif_sk(created_at: str, notif_id: str) -> str:
    return f"NOTIF#{created_at}#{notif_id}"


def _user_partition_pk(org_id: str, user_id: str) -> str:
    """Per-user partition used for both PROFILE and NOTIF# SKs. We
    reuse the existing USER partition so a single query can bulk-
    fetch a user's notifications without a GSI."""
    return tenant_keys.user_pk(org_id, user_id)


def create(
    org_id: str,
    user_id: str,
    *,
    type: str,
    title: str,
    message: str = "",
    link: str = "",
    metadata: Optional[dict] = None,
) -> None:
    """Emit one notification. Fire-and-forget — never raises.

    `org_id` + `user_id` are explicit so emitters called from
    scheduled-Lambda contexts (where the ContextVar isn't set) work
    correctly. Handlers driven by a live AuthContext can pass
    `auth.org_id`.
    """
    if not org_id or not user_id:
        return
    try:
        notif_id = uuid.uuid4().hex[:12]
        created_at = datetime.now(timezone.utc).isoformat()
        item: dict[str, Any] = {
            "PK": _user_partition_pk(org_id, user_id),
            "SK": _notif_sk(created_at, notif_id),
            "org_id": org_id,
            "user_id": user_id,
            "notif_id": notif_id,
            "type": type,
            "title": title or type,
            "message": message,
            "link": link,
            "created_at": created_at,
        }
        if metadata:
            item["metadata"] = json.dumps(metadata, default=str)[:2000]
        get_table().put_item(Item=item)
    except Exception as e:
        log.warning(
            "notification-write-failed",
            extra={
                "org_id": org_id, "user_id": user_id,
                "type": type, "error": str(e),
            },
        )


def list_for_user(
    org_id: str,
    user_id: str,
    *,
    limit: int = 50,
    unread_only: bool = False,
) -> list[dict]:
    """Latest `limit` notifications, newest first. Filters client-side
    for the unread subset — simpler than a GSI when volumes are small.
    """
    resp = get_table().query(
        KeyConditionExpression=(
            Key("PK").eq(_user_partition_pk(org_id, user_id))
            & Key("SK").begins_with("NOTIF#")
        ),
        ScanIndexForward=False,  # newest first
        Limit=max(1, min(limit, 200)),
    )
    items = resp.get("Items", [])
    out = []
    for it in items:
        if unread_only and it.get("read_at"):
            continue
        out.append(_to_dict(it))
    return out


def mark_read(org_id: str, user_id: str, notif_id: str) -> bool:
    """Set `read_at` on a single notification. Returns True on success,
    False when the item wasn't found (common when the frontend double-
    marks or the ID is stale). Scan-then-update because we don't have
    the full SK in hand (FE only round-trips the notif_id).
    """
    resp = get_table().query(
        KeyConditionExpression=(
            Key("PK").eq(_user_partition_pk(org_id, user_id))
            & Key("SK").begins_with("NOTIF#")
        ),
        FilterExpression="notif_id = :nid",
        ExpressionAttributeValues={":nid": notif_id},
        Limit=1,
    )
    items = resp.get("Items", [])
    if not items:
        return False
    item = items[0]
    get_table().update_item(
        Key={"PK": item["PK"], "SK": item["SK"]},
        UpdateExpression="SET read_at = :r",
        ExpressionAttributeValues={
            ":r": datetime.now(timezone.utc).isoformat(),
        },
    )
    return True


def mark_all_read(org_id: str, user_id: str) -> int:
    """Bulk-mark every unread notification as read. Returns the count
    flipped. Keeps iteration tight — don't care about pagination past
    200 since that's the soft cap on the list endpoint too."""
    resp = get_table().query(
        KeyConditionExpression=(
            Key("PK").eq(_user_partition_pk(org_id, user_id))
            & Key("SK").begins_with("NOTIF#")
        ),
        ScanIndexForward=False,
        Limit=200,
    )
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for it in resp.get("Items", []):
        if it.get("read_at"):
            continue
        get_table().update_item(
            Key={"PK": it["PK"], "SK": it["SK"]},
            UpdateExpression="SET read_at = :r",
            ExpressionAttributeValues={":r": now},
        )
        count += 1
    return count


def _to_dict(item: dict) -> dict:
    return {
        "notif_id": item.get("notif_id"),
        "type": item.get("type"),
        "title": item.get("title"),
        "message": item.get("message"),
        "link": item.get("link"),
        "read_at": item.get("read_at"),
        "created_at": item.get("created_at"),
        "metadata": _maybe_parse(item.get("metadata")),
    }


def _maybe_parse(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return raw
    return raw
