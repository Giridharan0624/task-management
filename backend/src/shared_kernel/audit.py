"""Audit log — who did what, when, in which tenant.

Written from existing handlers via `audit.record(...)`. No new routes for
writing (fits under the 500-resource CFN cap). Reads go through a
dedicated viewer Lambda that wires up after the nested-stack refactor.

Schema:
    PK = ORG#{org_id}#AUDIT           # all events for an org in one partition
    SK = EVENT#{created_at}#{event_id}  # time-ordered, tie-break by uuid

Writer contract:
    audit.record(
        auth, action='role.updated',
        target={'type': 'role', 'id': 'admin'},
        summary='Added task.delete.any to admin role',
        before={...optional snapshot}, after={...optional snapshot},
    )

Writes are fire-and-forget best-effort. If the audit put fails we log
and move on — missing an audit entry is never a good reason to break the
user's primary action.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from shared_kernel import tenant_keys
from shared_kernel.auth_context import AuthContext
from shared_kernel.dynamo_client import get_table

log = logging.getLogger("taskflow.audit")


# -- Action constants --------------------------------------------------------
# Centralize the vocabulary so dashboards and filters can rely on stable
# strings. Format: `<resource>.<verb>` where verb is past tense (it's a
# historical record, not an intent).

# Org
ORG_SETTINGS_UPDATED = "settings.updated"
ORG_SUSPENDED = "org.suspended"
ORG_RESUMED = "org.resumed"
ORG_DELETED = "org.deleted"
ORG_OWNERSHIP_TRANSFERRED = "org.ownership_transferred"

# Roles
ROLE_CREATED = "role.created"
ROLE_UPDATED = "role.updated"
ROLE_DELETED = "role.deleted"

# Users
USER_INVITED = "user.invited"
USER_CREATED = "user.created"
USER_ROLE_CHANGED = "user.role_changed"

# Note: PIPELINE_*, USER_DELETED, USER_SUSPENDED, PLAN_UPGRADED, and
# PLAN_DOWNGRADED constants were removed in Session 9 — they were
# defined but never emitted from any handler, which made the audit-
# log filter UI promise events that never appeared. Re-introduce when
# the corresponding handler actually fires the event:
#   - pipelines_router → PIPELINE_CREATED/UPDATED/DELETED
#   - delete_user handler → USER_DELETED
#   - (future user-suspension feature) → USER_SUSPENDED
#   - (future Stripe billing) → PLAN_UPGRADED / PLAN_DOWNGRADED


@dataclass(frozen=True)
class AuditTarget:
    """Thing the action was performed on."""
    type: str  # "role", "user", "settings", "pipeline", "org", "plan", ...
    id: str    # the specific record id, or "" for org-level actions


def record(
    auth: AuthContext,
    *,
    action: str,
    target: AuditTarget | dict,
    summary: str = "",
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Append one audit event to the log. Best-effort — never raises.

    `summary` is the one-line human-readable explanation shown in the
    UI timeline. `before`/`after` are optional state snapshots (dicts
    get JSON-encoded in storage).
    """
    try:
        tgt = target if isinstance(target, dict) else {
            "type": target.type, "id": target.id,
        }
        created_at = datetime.now(timezone.utc).isoformat()
        event_id = str(uuid.uuid4())[:12]
        item: dict[str, Any] = {
            "PK": tenant_keys.audit_pk(auth.org_id),
            "SK": tenant_keys.audit_sk(created_at, event_id),
            "org_id": auth.org_id,
            "event_id": event_id,
            "action": action,
            "actor_id": auth.user_id,
            "actor_email": auth.email,
            "actor_role": auth.system_role,
            "target_type": tgt.get("type", ""),
            "target_id": tgt.get("id", ""),
            "summary": summary or _default_summary(action, tgt),
            "created_at": created_at,
        }
        if before is not None:
            item["before"] = json.dumps(before, default=str)[:4000]
        if after is not None:
            item["after"] = json.dumps(after, default=str)[:4000]
        if metadata:
            item["metadata"] = json.dumps(metadata, default=str)[:2000]

        get_table().put_item(Item=item)
    except Exception as e:
        # Never break the primary action for an audit failure. Surface
        # enough in CloudWatch for ops to investigate.
        log.warning(
            "audit-write-failed",
            extra={
                "action": action,
                "org_id": getattr(auth, "org_id", ""),
                "actor_id": getattr(auth, "user_id", ""),
                "error": str(e),
            },
        )


def _default_summary(action: str, target: dict) -> str:
    """Fallback one-liner when the caller didn't provide a `summary`.
    Keeps the timeline readable even when writers forget — the domain
    tag + target-id is better than an empty string."""
    t_type = target.get("type", "")
    t_id = target.get("id", "")
    return f"{action} {t_type} {t_id}".strip()


# -- Reader (unwired until nested-stack refactor) ---------------------------

def list_events(
    org_id: str,
    *,
    limit: int = 50,
    cursor: Optional[str] = None,
    action_prefix: Optional[str] = None,
) -> tuple[list[dict], Optional[str]]:
    """Paginated reverse-chronological query. Returns (events, next_cursor).

    `cursor` is an opaque continuation token (the last seen SK). Callers
    pass it back verbatim for the next page. Filter `action_prefix` is
    client-side because DDB doesn't support `begins_with` on a sort key
    and a GSI on `action` is overkill until volumes justify it.
    """
    from boto3.dynamodb.conditions import Key

    kwargs: dict[str, Any] = {
        "KeyConditionExpression": Key("PK").eq(tenant_keys.audit_pk(org_id)),
        "ScanIndexForward": False,  # newest first
        "Limit": max(1, min(limit, 200)),
    }
    if cursor:
        try:
            kwargs["ExclusiveStartKey"] = json.loads(cursor)
        except (ValueError, TypeError):
            pass  # bad cursor — start from top

    resp = get_table().query(**kwargs)
    items = resp.get("Items", [])
    if action_prefix:
        items = [i for i in items if i.get("action", "").startswith(action_prefix)]

    next_cursor = None
    last_key = resp.get("LastEvaluatedKey")
    if last_key:
        next_cursor = json.dumps(last_key, default=str)

    return [_to_dict(i) for i in items], next_cursor


def _to_dict(item: dict) -> dict:
    return {
        "event_id": item.get("event_id"),
        "action": item.get("action"),
        "actor_id": item.get("actor_id"),
        "actor_email": item.get("actor_email"),
        "actor_role": item.get("actor_role"),
        "target_type": item.get("target_type"),
        "target_id": item.get("target_id"),
        "summary": item.get("summary"),
        "before": _maybe_parse(item.get("before")),
        "after": _maybe_parse(item.get("after")),
        "metadata": _maybe_parse(item.get("metadata")),
        "created_at": item.get("created_at"),
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
