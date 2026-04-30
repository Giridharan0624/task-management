"""The emitter is the only seam between existing handlers and the integration
platform. It MUST NOT raise — if a SQS quota is exhausted, the queue URL is
missing, the boto3 client errors out, or any other transient failure occurs,
the existing user-facing operation must still succeed.

These tests verify the contract for every realistic failure mode.
"""
from __future__ import annotations

import os

import pytest

from shared_kernel import integration_emitter


def test_emitter_no_op_when_queue_url_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INTEGRATIONS_OUTBOUND_QUEUE_URL", raising=False)
    integration_emitter.emit_item_changed("acme", "TASK", "t_001", "UPDATED")  # noqa: PT011 — must not raise


def test_emitter_swallows_sqs_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTEGRATIONS_OUTBOUND_QUEUE_URL", "https://sqs.bogus.invalid/q")

    class _Boom:
        def send_message(self, **kwargs):
            raise RuntimeError("boom — sqs is down")

    monkeypatch.setattr(integration_emitter, "_sqs_client", _Boom())
    integration_emitter.emit_item_changed("acme", "TASK", "t_002", "UPDATED")
    monkeypatch.setattr(integration_emitter, "_sqs_client", None)


def test_emitter_swallows_serialization_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTEGRATIONS_OUTBOUND_QUEUE_URL", "https://sqs.bogus.invalid/q")
    captured = {}

    class _Recorder:
        def send_message(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(integration_emitter, "_sqs_client", _Recorder())

    class _NotJson:
        def __repr__(self) -> str:
            return "<not json-serializable>"

    integration_emitter.emit_item_changed("acme", "TASK", _NotJson(), "UPDATED")
    monkeypatch.setattr(integration_emitter, "_sqs_client", None)


def test_emitter_swallows_when_boto_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTEGRATIONS_OUTBOUND_QUEUE_URL", "https://sqs.bogus.invalid/q")

    def _boom_factory():
        raise RuntimeError("cannot create boto client")

    monkeypatch.setattr(integration_emitter, "_sqs_client", None)
    monkeypatch.setattr(integration_emitter, "_sqs", _boom_factory)
    integration_emitter.emit_item_changed("acme", "TASK", "t_003", "UPDATED")
