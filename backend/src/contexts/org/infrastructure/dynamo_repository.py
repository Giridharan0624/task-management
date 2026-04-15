from typing import Optional

from boto3.dynamodb.conditions import Attr

from contexts.org.domain.entities import Invite, Organization, OrgSettings, Plan
from contexts.org.domain.repository import IOrgRepository
from contexts.org.infrastructure.mapper import OrgMapper
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table


class OrgDynamoRepository(IOrgRepository):
    def __init__(self) -> None:
        self._table = get_table()

    # ------------------------------------------------------------------
    # Organization
    # ------------------------------------------------------------------
    def find_by_id(self, org_id: str) -> Optional[Organization]:
        response = self._table.get_item(
            Key={"PK": tenant_keys.org_pk(org_id), "SK": tenant_keys.org_sk()}
        )
        item = response.get("Item")
        return OrgMapper.org_to_domain(item) if item else None

    def find_by_slug(self, slug: str) -> Optional[Organization]:
        # SLUG#{slug} SK=ORG is a reverse-lookup record written at signup.
        slug_resp = self._table.get_item(
            Key={"PK": tenant_keys.slug_pk(slug), "SK": tenant_keys.slug_sk()}
        )
        slug_item = slug_resp.get("Item")
        if not slug_item:
            return None
        return self.find_by_id(slug_item["org_id"])

    def save(self, org: Organization) -> None:
        """Save the ORG record AND the SLUG resolver record.

        These two writes are not transactional here. The signup use case
        in Phase 1 Step 7b uses TransactWriteItems for the atomic case
        (creates the org + settings + plan + first user + slug record
        all-or-nothing). This method exists for updates where atomicity
        is not required.
        """
        self._table.put_item(Item=OrgMapper.org_to_dynamo(org))
        self._table.put_item(Item=OrgMapper.slug_record(
            org.org_id, org.slug, org.created_at
        ))

    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------
    def save_settings(self, settings: OrgSettings) -> None:
        self._table.put_item(Item=OrgMapper.settings_to_dynamo(settings))

    def get_settings(self, org_id: str) -> Optional[OrgSettings]:
        response = self._table.get_item(
            Key={"PK": tenant_keys.org_pk(org_id), "SK": tenant_keys.settings_sk()}
        )
        item = response.get("Item")
        return OrgMapper.settings_to_domain(item) if item else None

    # ------------------------------------------------------------------
    # Plan
    # ------------------------------------------------------------------
    def save_plan(self, plan: Plan) -> None:
        self._table.put_item(Item=OrgMapper.plan_to_dynamo(plan))

    def get_plan(self, org_id: str) -> Optional[Plan]:
        response = self._table.get_item(
            Key={"PK": tenant_keys.org_pk(org_id), "SK": tenant_keys.plan_sk()}
        )
        item = response.get("Item")
        return OrgMapper.plan_to_domain(item) if item else None

    # ------------------------------------------------------------------
    # Invite (used in Phase 2; Phase 1 defines only the plumbing)
    # ------------------------------------------------------------------
    def save_invite(self, invite: Invite) -> None:
        self._table.put_item(Item=OrgMapper.invite_to_dynamo(invite))

    def find_invite_by_token(self, token: str) -> Optional[Invite]:
        # Phase 1 uses a scan — invite volume is low and Phase 2 will
        # replace this with a GSI or a PK=INVITE#{token} resolver item.
        response = self._table.scan(
            FilterExpression=Attr("SK").eq(tenant_keys.invite_sk(token))
        )
        items = response.get("Items", [])
        if not items:
            return None
        return OrgMapper.invite_to_domain(items[0])
