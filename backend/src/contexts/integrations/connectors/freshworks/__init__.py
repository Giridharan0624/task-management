"""Importing this package registers the Freshworks connector with the
platform's default registry. The platform never imports this module
directly — instead, an explicit `register()` call happens during Lambda
container startup (see contexts.integrations.bootstrap)."""

from contexts.integrations.connectors.freshworks.connector import (  # noqa: F401
    FreshworksConnector,
)
