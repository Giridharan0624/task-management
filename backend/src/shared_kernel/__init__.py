# Trigger Sentry init on cold start via the shared_kernel import chain.
# No-op when SENTRY_DSN is unset or the SDK isn't in the deps layer.
from shared_kernel.observability import init_sentry as _init_sentry

_init_sentry()
