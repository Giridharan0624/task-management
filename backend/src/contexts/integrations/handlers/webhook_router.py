"""Single Lambda for the unauthenticated webhook URL — same dispatcher
strategy as admin_router, except the path under {proxy+} encodes
provider/org_id/integration_id. Keeps the API Gateway resource count low.
"""
from __future__ import annotations

from contexts.integrations import bootstrap as _bootstrap  # noqa: F401 — registers connectors at cold start
from contexts.integrations.handlers import webhook_dispatch


def handler(event, context):
    path_params = event.get("pathParameters") or {}
    proxy = path_params.get("proxy") or ""
    parts = [p for p in proxy.split("/") if p]

    # Expect: {provider}/webhook/{org_id}/{integration_id}
    if len(parts) >= 4 and parts[1] == "webhook":
        provider = parts[0]
        org_id = parts[2]
        integration_id = parts[3]
        event["pathParameters"] = {
            **path_params,
            "provider": provider,
            "org_id": org_id,
            "integration_id": integration_id,
        }

    return webhook_dispatch.handler(event, context)
