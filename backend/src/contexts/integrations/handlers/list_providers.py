"""GET /integrations/providers — public catalog of installed connectors.

Anyone authenticated in any org can read the catalog (it doesn't leak any
tenant data). The plan gate kicks in at /integrations POST, not here.
"""
from __future__ import annotations

from contexts.integrations.application.list_providers import list_providers
from contexts.integrations.domain.connector_registry import default_registry
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        return build_success(200, {"providers": list_providers(default_registry)})
    except Exception as e:
        return build_error(e)
