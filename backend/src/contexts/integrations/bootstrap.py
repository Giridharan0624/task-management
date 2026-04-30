"""One-time registration of every installed connector with the default
registry. Imported by every integration Lambda at module-load time.

The platform never imports a specific connector — it imports this file,
which imports each connector module. CI gates ensure no other platform
code reaches into `connectors/` directly.

Adding a new connector here is the ONLY platform-side change needed when
landing a new provider; the connector module itself does the registration.
"""
from __future__ import annotations

from contexts.integrations.connectors.freshworks.connector import FreshworksConnector
from contexts.integrations.domain.connector_registry import default_registry


_BOOTSTRAPPED = False


def bootstrap() -> None:
    """Register every installed connector. Idempotent — safe to call from
    every Lambda's module init. Lambda containers run this once per cold
    start; warm invocations skip via the `_BOOTSTRAPPED` guard."""
    global _BOOTSTRAPPED
    if _BOOTSTRAPPED:
        return

    if not default_registry.has(FreshworksConnector.provider):
        default_registry.register(FreshworksConnector())

    _BOOTSTRAPPED = True


# Side-effect at import time — one register call per cold start.
bootstrap()
