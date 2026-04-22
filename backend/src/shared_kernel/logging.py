"""Structured JSON logging for Lambda handlers.

Every log record is a single JSON line with a stable key schema:

    {"ts": "...", "level": "INFO", "msg": "...",
     "request_id": "...", "org_id": "...", "user_id": "...",
     "handler": "...", "elapsed_ms": 123, **extra}

CloudWatch Insights can query by key directly
(`filter org_id = 'acme'`, `stats avg(elapsed_ms) by handler`).

Usage:
    from shared_kernel.logging import logger, bind

    def handler(event, context):
        with bind(event=event, context=context, handler="create_task"):
            logger.info("handling request")
            ...
            logger.info("task created", task_id=task.id)

The `bind` context manager stamps request_id / org_id / user_id /
handler name onto every record emitted inside its block. Safe across
concurrent invocations because the context lives in a `ContextVar`.

Kept dependency-free (stdlib only) — Lambda cold start matters and this
module is imported by every handler.
"""
from __future__ import annotations

import contextlib
import json
import logging
import sys
import time
from contextvars import ContextVar
from typing import Any, Iterator


# Per-request context. Kept as a plain dict inside a ContextVar so nested
# `bind()` calls can merge fields cleanly.
_ctx: ContextVar[dict[str, Any]] = ContextVar("log_ctx", default={})


class _JsonFormatter(logging.Formatter):
    """Render each record as a single JSON line.

    Robust to non-serialisable extras: anything that doesn't JSON-encode
    gets `repr()`'d so a misshapen log payload never kills the handler.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)
            ),
            "level": record.levelname,
            "msg": record.getMessage(),
        }
        payload.update(_ctx.get())
        # `extra=` kwargs on logger calls land as record attributes.
        for k, v in record.__dict__.items():
            if k in payload or k in _SKIP_ATTRS:
                continue
            payload[k] = v
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        try:
            return json.dumps(payload, default=repr, ensure_ascii=False)
        except Exception:
            # Last-resort fallback so we never raise inside logging.
            return json.dumps(
                {"level": "ERROR", "msg": "log-format-failed", "raw": repr(payload)}
            )


# Attribute names LogRecord adds that we don't want in the JSON output.
_SKIP_ATTRS = {
    "args", "asctime", "created", "exc_info", "exc_text", "filename",
    "funcName", "levelname", "levelno", "lineno", "message", "module",
    "msecs", "msg", "name", "pathname", "process", "processName",
    "relativeCreated", "stack_info", "thread", "threadName",
    "taskName",
}


def _build_logger() -> logging.Logger:
    log = logging.getLogger("taskflow")
    log.setLevel(logging.INFO)
    # Lambda installs its own handler on the root logger that writes a
    # plain-text format. We attach our JSON handler to `taskflow` only
    # and disable propagation so we don't double-log.
    log.propagate = False
    if log.handlers:
        return log
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(_JsonFormatter())
    log.addHandler(h)
    return log


logger = _build_logger()


@contextlib.contextmanager
def bind(
    *,
    event: dict | None = None,
    context: Any = None,
    handler: str | None = None,
    **extra: Any,
) -> Iterator[None]:
    """Bind request context for the duration of the block.

    Pulls `requestContext.requestId` and the Cognito claims out of the
    API Gateway event shape so handlers don't have to stamp them
    manually. Anything else passed as kwargs is added verbatim.

    On exit emits a summary log line with `elapsed_ms` — gives every
    handler a free "request completed" record for Insights queries.
    """
    token = _ctx.set({**_ctx.get(), **_derive(event, context, handler), **extra})
    started = time.time()
    try:
        yield
    except Exception:
        logger.exception("handler-exception")
        raise
    finally:
        elapsed_ms = int((time.time() - started) * 1000)
        logger.info("handler-complete", extra={"elapsed_ms": elapsed_ms})
        _ctx.reset(token)


def _derive(
    event: dict | None, context: Any, handler: str | None
) -> dict[str, Any]:
    """Pull correlation ids out of the Lambda event/context."""
    out: dict[str, Any] = {}
    if handler:
        out["handler"] = handler
    if context is not None:
        req_id = getattr(context, "aws_request_id", None)
        if req_id:
            out["request_id"] = req_id
    if isinstance(event, dict):
        rc = event.get("requestContext") or {}
        claims = (rc.get("authorizer") or {}).get("claims") or {}
        if rc.get("requestId"):
            out["api_request_id"] = rc["requestId"]
        if claims.get("sub"):
            out["user_id"] = claims["sub"]
        if claims.get("custom:orgId"):
            out["org_id"] = claims["custom:orgId"]
    return out
