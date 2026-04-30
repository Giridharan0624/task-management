"""Single Lambda that routes every authenticated /integrations/* admin
request by method + path. Done this way to keep the parent CDK stack under
the 500-resource CloudFormation cap — separate Lambdas + routes per endpoint
would push us over.

Each branch delegates to the handler that previously existed as a standalone
Lambda. Those handler modules remain valid call sites and are still imported
directly by their tests; this router just wraps them.
"""
from __future__ import annotations

from contexts.integrations import bootstrap as _bootstrap  # noqa: F401 — registers connectors at cold start
from contexts.integrations.handlers import (
    connect_integration as _connect,
    delete_integration as _delete,
    get_integration as _get,
    list_integrations as _list,
    list_providers as _providers,
)
from shared_kernel.errors import ValidationError
from shared_kernel.response import build_error


def handler(event, context):
    try:
        method = (event.get("httpMethod") or "GET").upper()
        path_params = event.get("pathParameters") or {}
        proxy = path_params.get("proxy") or ""
        parts = [p for p in proxy.split("/") if p]

        # GET /integrations
        if method == "GET" and not parts:
            return _list.handler(event, context)

        # GET /integrations/providers
        if method == "GET" and parts == ["providers"]:
            return _providers.handler(event, context)

        # POST /integrations/{provider}
        if method == "POST" and len(parts) == 1:
            event["pathParameters"] = {**path_params, "provider": parts[0]}
            return _connect.handler(event, context)

        # GET /integrations/{integration_id}
        if method == "GET" and len(parts) == 1:
            event["pathParameters"] = {**path_params, "integration_id": parts[0]}
            return _get.handler(event, context)

        # DELETE /integrations/{integration_id}
        if method == "DELETE" and len(parts) == 1:
            event["pathParameters"] = {**path_params, "integration_id": parts[0]}
            return _delete.handler(event, context)

        raise ValidationError(f"unsupported route: {method} /integrations/{proxy}")
    except Exception as e:
        return build_error(e)
