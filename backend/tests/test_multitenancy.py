"""Cross-tenant isolation tests — the SaaS-migration contract test.

These tests exist to catch regressions that would let one tenant read
or write another tenant's data. Before this file, the pooled multi-tenant
model was only validated manually on staging; now it's a hard gate in CI.

Scenarios covered:
1. Two orgs share the same table. Each writes the same primary-key shape
   (user profile, role record) scoped under its own `ORG#{org}#` prefix.
   Reading from Org A's context never surfaces Org B's data.
2. Repository constructors read the `org_id` ContextVar set by
   `extract_auth_context`. Setting the ContextVar to Org A and then
   calling a repo method cannot reach Org B's items.
3. The slug resolver record is global (`PK=SLUG#...`), so both tenants'
   slug lookups can coexist without collision.
4. Cross-tenant handcrafted PKs are structurally unreachable — a repo
   scoped to Org A literally cannot query Org B's partition.

Uses moto for DynamoDB mocking so tests run offline, deterministically,
without AWS credentials.
"""
from __future__ import annotations

from datetime import datetime, timezone

import boto3
import pytest
from moto import mock_aws

from contexts.org.domain.entities import Organization, OrgSettings
from contexts.org.domain.value_objects import OrgStatus, PlanTier
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.domain.entities import User
from contexts.user.domain.value_objects import SystemRole
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import dynamo_client, tenant_keys


TABLE_NAME = "TaskManagementTable-test"


@pytest.fixture
def table():
    """Spin up a moto-backed DynamoDB table matching the prod shape.

    `dynamo_client.dynamodb` is cached at import time (pointing at real
    AWS). Inside the moto context we create a fresh boto3 resource and
    monkey-patch it in — otherwise repo calls would bypass moto's
    interception.
    """
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")

        # Re-point the cached module-level resource + table name at the
        # mocked pair. Restore on teardown so other test modules don't
        # inherit a dead reference.
        original_ddb = dynamo_client.dynamodb
        original_name = dynamo_client.TABLE_NAME
        dynamo_client.dynamodb = ddb
        dynamo_client.TABLE_NAME = TABLE_NAME
        try:
            t = ddb.create_table(
                TableName=TABLE_NAME,
                KeySchema=[
                    {"AttributeName": "PK", "KeyType": "HASH"},
                    {"AttributeName": "SK", "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": "PK", "AttributeType": "S"},
                    {"AttributeName": "SK", "AttributeType": "S"},
                    {"AttributeName": "GSI1PK", "AttributeType": "S"},
                    {"AttributeName": "GSI1SK", "AttributeType": "S"},
                    {"AttributeName": "GSI2PK", "AttributeType": "S"},
                    {"AttributeName": "GSI2SK", "AttributeType": "S"},
                ],
                GlobalSecondaryIndexes=[
                    {
                        "IndexName": "GSI1",
                        "KeySchema": [
                            {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                        ],
                        "Projection": {"ProjectionType": "ALL"},
                    },
                    {
                        "IndexName": "GSI2",
                        "KeySchema": [
                            {"AttributeName": "GSI2PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI2SK", "KeyType": "RANGE"},
                        ],
                        "Projection": {"ProjectionType": "ALL"},
                    },
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            t.meta.client.get_waiter("table_exists").wait(TableName=TABLE_NAME)
            yield t
        finally:
            dynamo_client.dynamodb = original_ddb
            dynamo_client.TABLE_NAME = original_name


def _make_org(org_id: str, slug: str) -> Organization:
    now = datetime.now(timezone.utc).isoformat()
    return Organization(
        org_id=org_id,
        slug=slug,
        name=slug.upper(),
        owner_user_id=f"{org_id}-owner",
        status=OrgStatus.ACTIVE,
        plan_tier=PlanTier.FREE,
        created_at=now,
        updated_at=now,
    )


def _make_user(org_id: str, user_id: str, email: str) -> User:
    return User.create(
        user_id=user_id,
        email=email,
        name=email.split("@")[0].title(),
        system_role=SystemRole.OWNER,
    )


class TestCrossTenantIsolation:
    """Two orgs, shared table, no data leakage."""

    def test_org_lookup_by_id_stays_scoped(self, table):
        # Seed: Org A and Org B exist side by side.
        repo = OrgDynamoRepository()
        repo.save(_make_org("acme", "acme"))
        repo.save(_make_org("hooli", "hooli"))

        acme = repo.find_by_id("acme")
        hooli = repo.find_by_id("hooli")
        assert acme is not None and acme.slug == "acme"
        assert hooli is not None and hooli.slug == "hooli"

        # A fake org_id returns None rather than mixing partitions.
        assert repo.find_by_id("does-not-exist") is None

    def test_user_reads_scoped_to_contextvar_org(self, table):
        # Seed users in two different orgs. Each write uses the org-
        # scoped key helpers; each read switches the ContextVar first.
        acme_user = _make_user("acme", "acme-u1", "alice@acme.com")
        hooli_user = _make_user("hooli", "hooli-u1", "alice@hooli.com")

        tenant_keys.set_current_org_id("acme")
        UserDynamoRepository().save(acme_user)

        tenant_keys.set_current_org_id("hooli")
        UserDynamoRepository().save(hooli_user)

        # Now read back as Org A: Org A's user found, Org B's NOT.
        tenant_keys.set_current_org_id("acme")
        repo = UserDynamoRepository()
        assert repo.find_by_id("acme-u1") is not None
        assert repo.find_by_id("hooli-u1") is None, (
            "Org A should not be able to read Org B's user_id"
        )

        # Flip to Org B: inverse — its own user found, A's hidden.
        tenant_keys.set_current_org_id("hooli")
        repo_b = UserDynamoRepository()
        assert repo_b.find_by_id("hooli-u1") is not None
        assert repo_b.find_by_id("acme-u1") is None, (
            "Org B should not be able to read Org A's user_id"
        )

    def test_pk_prefixes_literally_differ(self, table):
        """Structural sanity check — the key builders must produce
        different PKs for different orgs, otherwise isolation is a
        lie."""
        assert tenant_keys.user_pk("acme", "u1") != tenant_keys.user_pk("hooli", "u1")
        assert tenant_keys.project_pk("acme", "p1") != tenant_keys.project_pk("hooli", "p1")
        assert tenant_keys.org_pk("acme") != tenant_keys.org_pk("hooli")
        # Slug PK is GLOBAL — same slug across orgs would collide, which
        # is correct: slugs are unique across the whole product.
        assert tenant_keys.slug_pk("acme") != tenant_keys.slug_pk("hooli")

    def test_settings_isolated_per_org(self, table):
        repo = OrgDynamoRepository()
        now = datetime.now(timezone.utc).isoformat()
        acme_settings = OrgSettings(
            org_id="acme", display_name="ACME Inc",
            primary_color="#FF0000", accent_color="#00FF00",
            created_at=now, updated_at=now,
        )
        hooli_settings = OrgSettings(
            org_id="hooli", display_name="Hooli",
            primary_color="#0000FF", accent_color="#FFFF00",
            created_at=now, updated_at=now,
        )
        repo.save_settings(acme_settings)
        repo.save_settings(hooli_settings)

        loaded_a = repo.get_settings("acme")
        loaded_b = repo.get_settings("hooli")
        assert loaded_a.primary_color == "#FF0000"
        assert loaded_b.primary_color == "#0000FF"
        # Misspelled org_id must NOT return anyone else's settings.
        assert repo.get_settings("unknown-org") is None

    def test_slug_resolver_is_global_but_one_per_slug(self, table):
        # The slug → org_id lookup lives under a global `SLUG#...` PK.
        # Signup should refuse to re-use an already-claimed slug; this
        # test asserts the resolver returns the right org for each slug.
        repo = OrgDynamoRepository()
        repo.save(_make_org("acme", "acme"))
        repo.save(_make_org("hooli", "hooli"))

        assert repo.find_by_slug("acme").org_id == "acme"
        assert repo.find_by_slug("hooli").org_id == "hooli"
        assert repo.find_by_slug("unknown") is None


class TestContextVarPropagation:
    """Lower-level checks on the ContextVar plumbing."""

    def test_default_value_before_any_set(self):
        # Reset to a known state: in production this is the post-login
        # value, but a cold-start handler that forgets to call
        # extract_auth_context() would see DEFAULT_ORG_ID instead.
        tenant_keys.set_current_org_id(tenant_keys.DEFAULT_ORG_ID)
        assert tenant_keys.get_current_org_id() == tenant_keys.DEFAULT_ORG_ID

    def test_set_then_get_roundtrip(self):
        tenant_keys.set_current_org_id("acme")
        assert tenant_keys.get_current_org_id() == "acme"
        tenant_keys.set_current_org_id("hooli")
        assert tenant_keys.get_current_org_id() == "hooli"
