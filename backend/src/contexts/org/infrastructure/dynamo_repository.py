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

    def list_all_orgs(self) -> list[Organization]:
        """Scan every Organization record across the table. Used by the
        nightly auto-generate-summaries Lambda (and any other system-level
        cross-tenant job). Filters out SLUG# resolver records which share
        the SK="ORG" sort key but are global, not per-org records."""
        items: list[dict] = []
        response = self._table.scan(
            FilterExpression=Attr("SK").eq(tenant_keys.org_sk())
            & Attr("PK").begins_with("ORG#")
        )
        items.extend(response.get("Items", []))
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").eq(tenant_keys.org_sk())
                & Attr("PK").begins_with("ORG#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        # Belt-and-suspenders: ensure the PK looks like exactly `ORG#{id}`
        # (no further `#` segments), excluding any items that snuck through.
        return [
            OrgMapper.org_to_domain(it)
            for it in items
            if it.get("PK", "").count("#") == 1
        ]

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
    # Invite
    # ------------------------------------------------------------------
    def save_invite(self, invite: Invite) -> None:
        """Write both the org-scoped invite record AND the global
        INVITE_TOKEN# lookup so public accept-invite can resolve the
        token to an org_id in O(1) without a scan."""
        self._table.put_item(Item=OrgMapper.invite_to_dynamo(invite))
        self._table.put_item(
            Item={
                "PK": tenant_keys.invite_token_lookup_pk(invite.token),
                "SK": tenant_keys.invite_token_lookup_sk(),
                "token": invite.token,
                "org_id": invite.org_id,
                "expires_at": invite.expires_at,
                "created_at": invite.created_at,
            }
        )

    def find_invite_by_token(self, token: str) -> Optional[Invite]:
        # O(1) lookup via the global INVITE_TOKEN# record -> org_id -> org-scoped invite
        lookup_resp = self._table.get_item(
            Key={
                "PK": tenant_keys.invite_token_lookup_pk(token),
                "SK": tenant_keys.invite_token_lookup_sk(),
            }
        )
        lookup = lookup_resp.get("Item")
        if not lookup:
            return None
        invite_resp = self._table.get_item(
            Key={
                "PK": tenant_keys.org_pk(lookup["org_id"]),
                "SK": tenant_keys.invite_sk(token),
            }
        )
        invite_item = invite_resp.get("Item")
        if not invite_item:
            return None
        return OrgMapper.invite_to_domain(invite_item)

    def mark_invite_accepted(self, org_id: str, token: str, accepted_at: str) -> None:
        """Set the accepted_at timestamp on the org-scoped invite record.
        The lookup record is left in place so the token can't be reused
        (accept-invite checks `accepted_at` before proceeding)."""
        self._table.update_item(
            Key={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.invite_sk(token),
            },
            UpdateExpression="SET accepted_at = :a",
            ExpressionAttributeValues={":a": accepted_at},
        )

    def delete_invite(self, org_id: str, token: str) -> None:
        """Revoke an invite — removes both the org-scoped record and the
        global lookup so the token becomes unresolvable."""
        self._table.delete_item(
            Key={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.invite_sk(token),
            }
        )
        self._table.delete_item(
            Key={
                "PK": tenant_keys.invite_token_lookup_pk(token),
                "SK": tenant_keys.invite_token_lookup_sk(),
            }
        )

    def list_invites(self, org_id: str) -> list[Invite]:
        """All invite records under this org — includes accepted and
        unaccepted. Callers filter by `accepted_at` / `expires_at` as
        needed."""
        from boto3.dynamodb.conditions import Key as _K
        response = self._table.query(
            KeyConditionExpression=_K("PK").eq(tenant_keys.org_pk(org_id))
            & _K("SK").begins_with("INVITE#")
        )
        return [OrgMapper.invite_to_domain(item) for item in response.get("Items", [])]

    # ------------------------------------------------------------------
    # Pipelines (Phase 5)
    # ------------------------------------------------------------------
    def save_pipeline(self, org_id: str, pipeline: dict) -> None:
        """Persist a pipeline record. Statuses are stored as a JSON string
        for compactness; list_pipelines decodes them."""
        import json
        self._table.put_item(
            Item={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.pipeline_sk(pipeline["pipeline_id"]),
                "org_id": org_id,
                "pipeline_id": pipeline["pipeline_id"],
                "name": pipeline["name"],
                "is_default": bool(pipeline.get("is_default", False)),
                "statuses": json.dumps(pipeline.get("statuses", [])),
                "created_at": pipeline["created_at"],
                "updated_at": pipeline["updated_at"],
            }
        )

    def delete_pipeline(self, org_id: str, pipeline_id: str) -> None:
        self._table.delete_item(
            Key={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.pipeline_sk(pipeline_id),
            }
        )

    def list_pipelines(self, org_id: str) -> list[dict]:
        import json
        from boto3.dynamodb.conditions import Key as _K
        response = self._table.query(
            KeyConditionExpression=_K("PK").eq(tenant_keys.org_pk(org_id))
            & _K("SK").begins_with("PIPELINE#")
        )
        items = response.get("Items", [])
        out = []
        for it in items:
            raw = it.get("statuses", "[]")
            if isinstance(raw, str):
                try:
                    statuses = json.loads(raw)
                except (ValueError, TypeError):
                    statuses = []
            elif isinstance(raw, list):
                statuses = raw
            else:
                statuses = []
            out.append({
                "org_id": it.get("org_id"),
                "pipeline_id": it.get("pipeline_id"),
                "name": it.get("name"),
                "is_default": bool(it.get("is_default", False)),
                "statuses": statuses,
                "created_at": it.get("created_at"),
                "updated_at": it.get("updated_at"),
            })
        # Default pipeline first; then alphabetical by name.
        out.sort(key=lambda p: (0 if p["is_default"] else 1, p.get("name", "")))
        return out

    # ------------------------------------------------------------------
    # Roles (Phase 4)
    # ------------------------------------------------------------------
    def get_role(self, org_id: str, role_id: str) -> Optional[dict]:
        import json
        resp = self._table.get_item(
            Key={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.role_sk(role_id),
            }
        )
        item = resp.get("Item")
        if not item:
            return None
        raw = item.get("permissions", "[]")
        if isinstance(raw, str):
            try:
                perms = json.loads(raw)
            except (ValueError, TypeError):
                perms = []
        elif isinstance(raw, (list, set)):
            perms = list(raw)
        else:
            perms = []
        return {
            "org_id": item.get("org_id"),
            "role_id": item.get("role_id"),
            "name": item.get("name"),
            "scope": item.get("scope", "system"),
            "is_system": bool(item.get("is_system", False)),
            "permissions": sorted(perms),
            "created_at": item.get("created_at"),
            "updated_at": item.get("updated_at"),
        }

    def save_role(self, role: dict) -> None:
        """Insert or replace a role record. Caller is responsible for
        loading-then-mutating; this is a full overwrite write."""
        import json
        self._table.put_item(
            Item={
                "PK": tenant_keys.org_pk(role["org_id"]),
                "SK": tenant_keys.role_sk(role["role_id"]),
                "org_id": role["org_id"],
                "role_id": role["role_id"],
                "name": role["name"],
                "scope": role.get("scope", "system"),
                "is_system": bool(role.get("is_system", False)),
                "permissions": json.dumps(sorted(role.get("permissions", []))),
                "created_at": role["created_at"],
                "updated_at": role["updated_at"],
            }
        )

    def delete_role(self, org_id: str, role_id: str) -> None:
        self._table.delete_item(
            Key={
                "PK": tenant_keys.org_pk(org_id),
                "SK": tenant_keys.role_sk(role_id),
            }
        )

    def list_roles(self, org_id: str) -> list[dict]:
        """Return all role records under an org, lightly normalized so the
        `permissions` field is always a list of strings (in storage it's a
        JSON-encoded string for compactness).
        """
        import json
        from boto3.dynamodb.conditions import Key as _K
        response = self._table.query(
            KeyConditionExpression=_K("PK").eq(tenant_keys.org_pk(org_id))
            & _K("SK").begins_with("ROLE#")
        )
        items = response.get("Items", [])
        result = []
        for it in items:
            raw = it.get("permissions", "[]")
            if isinstance(raw, str):
                try:
                    perms = json.loads(raw)
                except (ValueError, TypeError):
                    perms = []
            elif isinstance(raw, (list, set)):
                perms = list(raw)
            else:
                perms = []
            result.append({
                "org_id": it.get("org_id"),
                "role_id": it.get("role_id"),
                "name": it.get("name"),
                "scope": it.get("scope", "system"),
                "is_system": bool(it.get("is_system", False)),
                "permissions": sorted(perms),
                "created_at": it.get("created_at"),
                "updated_at": it.get("updated_at"),
            })
        # Stable order: system roles first (OWNER, ADMIN, MEMBER), then custom.
        order = {"owner": 0, "admin": 1, "member": 2}
        result.sort(key=lambda r: (order.get((r["role_id"] or "").lower(), 99), r["role_id"] or ""))
        return result
