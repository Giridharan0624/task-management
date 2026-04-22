"""Sentry initialization for Lambda cold starts.

Activates when:
  1. `sentry-sdk[aws_lambda]` is installed in the Lambda deps layer
  2. `SENTRY_DSN` env var is set on the function

Either missing → `init_sentry()` is a silent no-op. Lets us deploy
with the scaffold in place before the operator decides to flip it on.

Called once from `shared_kernel/__init__.py` so the import chain that
every handler triggers runs init during cold start (before any
exception can be thrown in the handler body).
"""
from __future__ import annotations

import logging
import os

log = logging.getLogger("taskflow.observability")

_initialized = False


def init_sentry() -> None:
    """Idempotent. Safe to call multiple times — module-level imports
    across Lambda warmups might trip this path more than once."""
    global _initialized
    if _initialized:
        return

    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        _initialized = True
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration
    except ImportError:
        # Package not in the deps layer. Deployment-time choice — ship
        # the code scaffold before the operator commits to the SaaS-
        # level telemetry bill.
        _initialized = True
        return

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=os.environ.get("ENVIRONMENT", "unknown"),
            release=os.environ.get("GIT_SHA", "unknown"),
            # Drop 90% of transactions by default — Lambdas fire thousands
            # per minute in aggregate across the 50+ handlers and the
            # free Sentry tier caps at 100k events/month. Errors are
            # always sent at 100% regardless of `traces_sample_rate`.
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_RATE", "0.1")),
            integrations=[AwsLambdaIntegration()],
            # PII — emails and org ids end up in audit logs; don't send
            # them to a third-party error tracker unless the operator
            # opts in.
            send_default_pii=False,
        )
        _initialized = True
    except Exception as e:
        # Don't let a sentry-init failure crash the handler on cold start.
        log.warning("sentry-init-failed: %s", e)
        _initialized = True
