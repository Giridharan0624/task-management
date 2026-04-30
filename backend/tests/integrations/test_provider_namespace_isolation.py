"""Two integrations from the SAME tenant under DIFFERENT providers must not
read or affect each other's ExternalLink rows. The (provider, external_id)
namespacing in tenant_keys.py is what enforces this; the test guards against
regressions that would conflate them.
"""
from __future__ import annotations

import boto3
import pytest
from moto import mock_aws

from contexts.integrations.domain.entities import ExternalLink
from contexts.integrations.domain.value_objects import ItemType
from contexts.integrations.infrastructure.external_link_repo_dynamo import (
    ExternalLinkDynamoRepository,
)
from shared_kernel import dynamo_client, tenant_keys


TABLE_NAME = "TaskManagementTable-test"


@pytest.fixture
def dynamo_table(monkeypatch: pytest.MonkeyPatch):
    with mock_aws():
        monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
        monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
        monkeypatch.setattr(dynamo_client, "TABLE_NAME", TABLE_NAME)
        monkeypatch.setattr(
            dynamo_client,
            "dynamodb",
            boto3.resource("dynamodb", region_name="us-east-1"),
        )
        ddb = dynamo_client.dynamodb
        ddb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        yield ddb.Table(TABLE_NAME)


def test_extlinks_isolated_by_provider(dynamo_table) -> None:
    repo = ExternalLinkDynamoRepository(org_id="acme")

    fd_link = ExternalLink.create(
        org_id="acme",
        provider="freshdesk",
        integration_id="i_fd",
        item_type=ItemType.TASK,
        item_id="task-001",
        external_id="999",
        external_url="https://acme.freshdesk.com/a/tickets/999",
    )
    slack_link = ExternalLink.create(
        org_id="acme",
        provider="slack",
        integration_id="i_slack",
        item_type=ItemType.TASK,
        item_id="task-001",
        external_id="999",
        external_url="https://acme.slack.com/archives/C/p999",
    )

    repo.save(fd_link)
    repo.save(slack_link)

    found_fd = repo.find_by_external("freshdesk", "999")
    found_slack = repo.find_by_external("slack", "999")

    assert found_fd is not None
    assert found_slack is not None
    assert found_fd.integration_id == "i_fd"
    assert found_slack.integration_id == "i_slack"
    assert found_fd.external_url != found_slack.external_url

    repo.delete("freshdesk", "999")
    assert repo.find_by_external("freshdesk", "999") is None
    assert repo.find_by_external("slack", "999") is not None


def test_extlinks_isolated_across_tenants(dynamo_table) -> None:
    acme_repo = ExternalLinkDynamoRepository(org_id="acme")
    other_repo = ExternalLinkDynamoRepository(org_id="other")

    acme_repo.save(
        ExternalLink.create(
            org_id="acme",
            provider="freshdesk",
            integration_id="i_a",
            item_type=ItemType.TASK,
            item_id="task-001",
            external_id="999",
        )
    )

    assert acme_repo.find_by_external("freshdesk", "999") is not None
    assert other_repo.find_by_external("freshdesk", "999") is None
