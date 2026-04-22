"""ANY /orgs/current/webhooks{,/{webhookId}} — webhook CRUD router.

Single Lambda handling the four REST verbs for webhook management.
Gated on SETTINGS_EDIT — tenants with permission to edit org
settings can also manage webhooks. Not delegated to a finer-grained
permission because the audience is the same (OWNER + whoever OWNER
grants SETTINGS_EDIT to).

Delivery itself is driven by `shared_kernel.webhooks.deliver(...)`
called from emitter handlers (task.created, etc.) — this router is
config-only.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, HttpUrl

from contexts.org.domain import permissions as P
from shared_kernel import audit, webhooks
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import require, require_not_suspended
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class CreateWebhookRequest(BaseModel):
    url: HttpUrl
    events: list[str] = Field(default_factory=lambda: ["*"])
    description: str = ""


class UpdateWebhookRequest(BaseModel):
    url: Optional[HttpUrl] = None
    events: Optional[list[str]] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        require(auth, P.SETTINGS_EDIT)

        method = (event.get("httpMethod") or "").upper()
        path_params = event.get("pathParameters") or {}
        webhook_id = (path_params.get("webhookId") or "").strip()

        if method == "GET":
            if webhook_id:
                # Single webhook fetch — just filter the list. Tiny
                # number per tenant; O(1) network call + O(n) in-
                # memory filter is fine.
                for wh in webhooks.list_for_org(auth.org_id):
                    if wh["webhook_id"] == webhook_id:
                        return build_success(200, wh)
                raise NotFoundError(f"Webhook {webhook_id} not found.")
            return build_success(200, {
                "webhooks": webhooks.list_for_org(auth.org_id),
            })

        if method == "POST":
            if webhook_id:
                raise ValidationError(
                    "POST on /webhooks/{id} is not supported. "
                    "Use PUT to update, DELETE to remove.",
                )
            req = validate_body(CreateWebhookRequest, event.get("body"))
            created = webhooks.create(
                auth.org_id,
                url=str(req.url),
                events=req.events,
                description=req.description,
            )
            audit.record(
                auth, action="webhook.created",
                target={"type": "webhook", "id": created["webhook_id"]},
                summary=f"Registered webhook → {created['url']}",
                metadata={"events": created["events"]},
            )
            return build_success(201, created)

        if method == "PUT":
            if not webhook_id:
                raise ValidationError("webhookId is required in the path.")
            req = validate_body(UpdateWebhookRequest, event.get("body"))
            updated = webhooks.update(
                auth.org_id, webhook_id,
                url=str(req.url) if req.url is not None else None,
                events=req.events,
                description=req.description,
                enabled=req.enabled,
            )
            if not updated:
                raise NotFoundError(f"Webhook {webhook_id} not found.")
            audit.record(
                auth, action="webhook.updated",
                target={"type": "webhook", "id": webhook_id},
                summary=f"Updated webhook {updated['url']}",
            )
            return build_success(200, updated)

        if method == "DELETE":
            if not webhook_id:
                raise ValidationError("webhookId is required in the path.")
            webhooks.delete(auth.org_id, webhook_id)
            audit.record(
                auth, action="webhook.deleted",
                target={"type": "webhook", "id": webhook_id},
                summary=f"Deleted webhook {webhook_id}",
            )
            return build_success(204, None)

        raise ValidationError(f"Unsupported method {method} on webhooks.")
    except Exception as e:
        return build_error(e)
