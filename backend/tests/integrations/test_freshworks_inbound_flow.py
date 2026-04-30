"""Inbound Freshworks tests — exercising the upsert use case end-to-end
against a moto-backed DynamoDB.

Covers:
  - First-sight ticket → new TaskFlow task created + ExternalLink written
  - Same ticket second time (idempotent) → updates existing task, no duplicate
  - assignee_email matches a TaskFlow user → task assigned (strict mode)
  - assignee_email unmatched → strict mode leaves unassigned
  - assignee_email unmatched → fallback mode assigns the configured user
"""
from __future__ import annotations

from datetime import datetime, timezone

import boto3
import pytest
from moto import mock_aws

from contexts.integrations.application.resolve_assignee import resolve_assignee
from contexts.integrations.application.upsert_task_from_external import (
    upsert_task_from_external,
)
from contexts.integrations.domain.entities import Integration
from contexts.integrations.domain.normalized import NormalizedItem
from contexts.integrations.domain.value_objects import AssigneeMode, IntegrationStatus
from contexts.integrations.infrastructure.external_link_repo_dynamo import (
    ExternalLinkDynamoRepository,
)
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.user.domain.entities import User
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import dynamo_client, tenant_keys


TABLE = "TaskManagementTable-test"


@pytest.fixture
def ddb(monkeypatch: pytest.MonkeyPatch):
    with mock_aws():
        monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
        monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
        monkeypatch.setattr(dynamo_client, "TABLE_NAME", TABLE)
        monkeypatch.setattr(
            dynamo_client,
            "dynamodb",
            boto3.resource("dynamodb", region_name="us-east-1"),
        )
        ddb = dynamo_client.dynamodb
        ddb.create_table(
            TableName=TABLE,
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        yield ddb.Table(TABLE)


def _integration(
    *,
    org_id: str = "acme",
    mode: AssigneeMode = AssigneeMode.STRICT,
    fallback: str | None = None,
    project: str | None = None,
) -> Integration:
    return Integration.create(
        integration_id="i_test",
        org_id=org_id,
        provider="freshdesk",
        display_name="Freshdesk: acme",
        account_id="acct_1",
        encrypted_credentials=b"\x00",
        webhook_secret_hash="hashed",
        connected_by="u_admin",
        assignee_mode=mode,
        fallback_assignee_id=fallback,
        linked_project_id=project,
    )


def _seed_user(email: str, user_id: str = "u_alice") -> None:
    repo = UserDynamoRepository(org_id="acme")
    repo.save(
        User(
            user_id=user_id,
            email=email,
            name=email.split("@")[0],
            system_role="MEMBER",
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    )


def test_first_sight_creates_task_and_external_link(ddb) -> None:
    integration = _integration()
    item = NormalizedItem(
        external_id="999",
        external_url="https://acme.freshdesk.com/a/tickets/999",
        title="Login broken",
        description="cannot log in",
        status="OPEN",
        priority="HIGH",
        due_at="2026-05-01T00:00:00Z",
    )
    task_repo = TaskDynamoRepository(org_id="acme")
    link_repo = ExternalLinkDynamoRepository(org_id="acme")

    task, created = upsert_task_from_external(
        integration=integration,
        item=item,
        task_repo=task_repo,
        link_repo=link_repo,
    )
    assert created is True
    assert task.title == "Login broken"
    assert task.status == "TODO"
    assert task.priority.value == "HIGH"
    link = link_repo.find_by_external("freshdesk", "999")
    assert link is not None
    assert link.item_id == task.task_id
    assert link.last_pulled_at is not None


def test_idempotent_second_webhook_updates_existing_task(ddb) -> None:
    integration = _integration()
    item_v1 = NormalizedItem(external_id="1", title="v1", status="OPEN", priority="LOW")
    task_repo = TaskDynamoRepository(org_id="acme")
    link_repo = ExternalLinkDynamoRepository(org_id="acme")

    task1, c1 = upsert_task_from_external(
        integration=integration, item=item_v1, task_repo=task_repo, link_repo=link_repo
    )
    assert c1 is True

    item_v2 = NormalizedItem(external_id="1", title="v2 updated", status="RESOLVED", priority="HIGH")
    task2, c2 = upsert_task_from_external(
        integration=integration, item=item_v2, task_repo=task_repo, link_repo=link_repo
    )
    assert c2 is False
    assert task1.task_id == task2.task_id
    assert task2.title == "v2 updated"
    assert task2.status == "DONE"


def test_strict_mode_with_known_email_assigns_user(ddb) -> None:
    _seed_user("alice@acme.com")
    integration = _integration(mode=AssigneeMode.STRICT)

    user_repo = UserDynamoRepository(org_id="acme")

    def _resolver(*, integration, agent_email):
        return resolve_assignee(
            integration=integration,
            agent_email=agent_email,
            user_repo=user_repo,
        )

    task, _ = upsert_task_from_external(
        integration=integration,
        item=NormalizedItem(external_id="2", title="hi"),
        agent_email="alice@acme.com",
        task_repo=TaskDynamoRepository(org_id="acme"),
        link_repo=ExternalLinkDynamoRepository(org_id="acme"),
        resolve_assignee=_resolver,
    )
    assert task.assigned_to == ["u_alice"]


def test_strict_mode_with_unknown_email_leaves_unassigned(ddb) -> None:
    integration = _integration(mode=AssigneeMode.STRICT)
    user_repo = UserDynamoRepository(org_id="acme")

    def _resolver(*, integration, agent_email):
        return resolve_assignee(integration=integration, agent_email=agent_email, user_repo=user_repo)

    task, _ = upsert_task_from_external(
        integration=integration,
        item=NormalizedItem(external_id="3", title="hi"),
        agent_email="ghost@nowhere.com",
        task_repo=TaskDynamoRepository(org_id="acme"),
        link_repo=ExternalLinkDynamoRepository(org_id="acme"),
        resolve_assignee=_resolver,
    )
    assert task.assigned_to == []


def test_fallback_mode_assigns_configured_user(ddb) -> None:
    integration = _integration(mode=AssigneeMode.FALLBACK, fallback="u_team_lead")
    user_repo = UserDynamoRepository(org_id="acme")

    def _resolver(*, integration, agent_email):
        return resolve_assignee(integration=integration, agent_email=agent_email, user_repo=user_repo)

    task, _ = upsert_task_from_external(
        integration=integration,
        item=NormalizedItem(external_id="4", title="hi"),
        agent_email="ghost@nowhere.com",
        task_repo=TaskDynamoRepository(org_id="acme"),
        link_repo=ExternalLinkDynamoRepository(org_id="acme"),
        resolve_assignee=_resolver,
    )
    assert task.assigned_to == ["u_team_lead"]
