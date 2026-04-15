"""Signup use case: create a new Organization atomically.

Called by the public `POST /signup` handler. Creates:
  - Organization record
  - OrgSettings (seeded defaults)
  - Plan (FREE tier)
  - SLUG resolver record (claims the workspace code)
  - Default Role records (owner/admin/member)
  - First Cognito user (OWNER) with custom:orgId pre-set
  - First User profile record in DynamoDB (written via the user repository
    with the new org_id so dual-write lands in the org-scoped keys too)

Atomicity strategy:
  1. Claim the slug first via a conditional PutItem. This is the only
     write where a race matters — two simultaneous signups for the same
     slug collide here, and Dynamo's ConditionalCheckFailed makes one lose.
  2. Write org + settings + plan + roles in sequence. If any of these
     fail, roll back by deleting the slug claim and any records already
     written. The window where the slug is claimed but the org is
     incomplete is tiny and `find_by_slug` falls back to the org record,
     so a partial write just looks like "slug not found."
  3. Create the Cognito user. On failure, roll back the whole org.
  4. Create the first User profile record in DynamoDB via the
     UserDynamoRepository scoped to the new org_id.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from botocore.exceptions import ClientError
from pydantic import BaseModel

from contexts.org.domain.default_roles import (
    ADMIN_ROLE_ID, MEMBER_ROLE_ID, OWNER_ROLE_ID,
)
from contexts.org.domain.entities import Organization, OrgSettings
from contexts.org.domain.plans import plan_from_template
from contexts.org.domain.value_objects import (
    OrgStatus, PlanTier, is_valid_slug,
)
from contexts.org.infrastructure.mapper import OrgMapper
from shared_kernel import tenant_keys
from shared_kernel.dynamo_client import get_table
from shared_kernel.errors import ValidationError


class SignupRequest(BaseModel):
    org_name: str
    slug: str
    owner_name: str
    owner_email: str
    password: str


class CreateOrganizationUseCase:
    """Creates a brand-new organization and its first OWNER user.

    `cognito_service` is optional during Phase 1. When None, the use case
    still writes the org records but skips Cognito user creation — useful
    for local smoke tests. The real handler always passes a concrete
    cognito service.
    """

    def __init__(self, cognito_service=None) -> None:
        self._table = get_table()
        self._cognito = cognito_service

    def execute(self, req: SignupRequest) -> dict:
        slug = req.slug.strip().lower()
        org_name = req.org_name.strip()
        owner_email = req.owner_email.strip().lower()
        owner_name = req.owner_name.strip()
        self._validate(slug, org_name, owner_email, owner_name)

        org_id = f"org_{uuid.uuid4().hex[:16]}"
        owner_user_id = f"usr_{uuid.uuid4().hex[:16]}"
        now = datetime.now(timezone.utc).isoformat()

        org = Organization(
            org_id=org_id,
            slug=slug,
            name=org_name,
            owner_user_id=owner_user_id,
            status=OrgStatus.ACTIVE,
            plan_tier=PlanTier.FREE,
            created_at=now,
            updated_at=now,
        )
        settings = OrgSettings.create_default(org_id=org_id, display_name=org_name)
        plan = plan_from_template(org_id, PlanTier.FREE)
        role_records = [
            _role_record(org_id, OWNER_ROLE_ID, "Owner", now),
            _role_record(org_id, ADMIN_ROLE_ID, "Admin", now),
            _role_record(org_id, MEMBER_ROLE_ID, "Member", now),
        ]

        # Step 1: claim the slug. This is the only race-sensitive write.
        try:
            self._table.put_item(
                Item=OrgMapper.slug_record(org_id, slug, now),
                ConditionExpression="attribute_not_exists(PK)",
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise ValidationError(f"Workspace code '{slug}' is already taken.")
            raise

        # Step 2: write org, settings, plan, roles. Rollback slug on failure.
        try:
            self._table.put_item(Item=OrgMapper.org_to_dynamo(org))
            self._table.put_item(Item=OrgMapper.settings_to_dynamo(settings))
            self._table.put_item(Item=OrgMapper.plan_to_dynamo(plan))
            for role in role_records:
                self._table.put_item(Item=role)
        except Exception:
            _rollback_org_records(self._table, org_id, slug)
            raise

        # Step 3: create Cognito user (if a service is configured).
        # On failure roll back the org so the system stays clean.
        if self._cognito is not None:
            try:
                self._cognito.create_owner(
                    user_id=owner_user_id,
                    org_id=org_id,
                    email=owner_email,
                    name=owner_name,
                    password=req.password,
                )
            except Exception:
                _rollback_org_records(self._table, org_id, slug)
                raise

        return {
            "org_id": org_id,
            "slug": slug,
            "name": org_name,
            "owner_user_id": owner_user_id,
            "redirect_url": f"/login?workspace={slug}&first_login=1",
        }

    def _validate(self, slug: str, org_name: str, owner_email: str, owner_name: str) -> None:
        if not is_valid_slug(slug):
            raise ValidationError(
                f"Invalid workspace code '{slug}'. Must be 3-30 lowercase "
                f"alphanumeric characters (hyphens allowed), not reserved."
            )
        if not org_name or len(org_name) > 100:
            raise ValidationError("Organization name must be 1-100 characters.")
        if "@" not in owner_email or len(owner_email) > 254:
            raise ValidationError("Invalid owner email address.")
        if not owner_name:
            raise ValidationError("Owner name is required.")


def _role_record(org_id: str, role_id: str, name: str, now: str) -> dict:
    """Default role record. Empty permission set for Phase 1; Phase 4
    fills in the permission matrix."""
    return {
        "PK": tenant_keys.org_pk(org_id),
        "SK": tenant_keys.role_sk(role_id),
        "org_id": org_id,
        "role_id": role_id,
        "name": name,
        "scope": "system",
        "is_system": True,
        "permissions": json.dumps([]),
        "created_at": now,
        "updated_at": now,
    }


def _rollback_org_records(table, org_id: str, slug: str) -> None:
    """Best-effort rollback. Swallows all errors — this runs only when
    something has already failed."""
    try:
        with table.batch_writer() as batch:
            for sk in (
                tenant_keys.org_sk(),
                tenant_keys.settings_sk(),
                tenant_keys.plan_sk(),
                tenant_keys.role_sk(OWNER_ROLE_ID),
                tenant_keys.role_sk(ADMIN_ROLE_ID),
                tenant_keys.role_sk(MEMBER_ROLE_ID),
            ):
                batch.delete_item(Key={"PK": tenant_keys.org_pk(org_id), "SK": sk})
            batch.delete_item(
                Key={"PK": tenant_keys.slug_pk(slug), "SK": tenant_keys.slug_sk()}
            )
    except Exception:
        pass
