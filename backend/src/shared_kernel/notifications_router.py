"""/users/me/notifications — single-Lambda router for list + actions.

Route shape is deliberately shallow to keep the CFN resource footprint
small:
    GET  /users/me/notifications
         Query: ?unread_only=true&limit=50
    POST /users/me/notifications
         Body: {"action": "mark_read", "notif_id": "abc123"}
             — Mark one notification as read.
         Body: {"action": "mark_all_read"}
             — Flip every unread notification for the caller.

Fewer routes = fewer AWS::ApiGateway::Method resources. Trade-off: the
frontend has to know about the action verbs. Documented in the JS
client so call sites stay readable.

Emission is not a public endpoint — other handlers call
`shared_kernel.notifications.create(org, user, ...)` directly when
something interesting happens (task.assigned, dayoff.approved, etc.).
"""
from __future__ import annotations

from shared_kernel import notifications
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import ValidationError
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from pydantic import BaseModel


class NotificationActionRequest(BaseModel):
    action: str
    notif_id: str | None = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        method = (event.get("httpMethod") or "").upper()

        if method == "GET":
            qs = event.get("queryStringParameters") or {}
            limit = int(qs.get("limit") or 50)
            unread_only = (qs.get("unread_only") or "").lower() in {"1", "true", "yes"}
            items = notifications.list_for_user(
                auth.org_id, auth.user_id,
                limit=limit, unread_only=unread_only,
            )
            return build_success(200, {"notifications": items})

        if method == "POST":
            req = validate_body(NotificationActionRequest, event.get("body"))
            if req.action == "mark_read":
                if not req.notif_id:
                    raise ValidationError("notif_id is required for mark_read.")
                ok = notifications.mark_read(
                    auth.org_id, auth.user_id, req.notif_id,
                )
                return build_success(200, {"found": ok})
            if req.action == "mark_all_read":
                count = notifications.mark_all_read(auth.org_id, auth.user_id)
                return build_success(200, {"marked_read": count})
            raise ValidationError(
                f"Unknown notification action: '{req.action}'.",
            )

        raise ValidationError(f"Unsupported method {method} on notifications.")
    except Exception as e:
        return build_error(e)
