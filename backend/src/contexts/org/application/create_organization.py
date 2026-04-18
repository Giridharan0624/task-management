"""Signup use case: create a new Organization + its first OWNER user.

Called by the public `POST /signup` handler. Creates, atomically enough
to leave no orphans on any failure:

  1. Slug resolver record (conditional put — atomic slug claim)
  2. Cognito user with the owner's chosen password (permanent, so they
     can log in immediately without a FORCE_CHANGE_PASSWORD dance)
  3. DynamoDB records: ORG, SETTINGS, PLAN, 3 default ROLE records,
     and the owner's USER profile (PK=ORG#{org_id}#USER#{sub})

Failure handling:
  - If slug claim fails (ConditionalCheckFailed) → return 409-style
    ValidationError, no other writes attempted
  - If Cognito create fails after slug claim succeeded → delete the
    slug record, return the Cognito error as a 500
  - If any DynamoDB write fails after Cognito succeeded → delete the
    Cognito user AND delete the slug record, return the error

The one non-atomic window is between Cognito create and the first
DynamoDB put. A Lambda crash in that window leaves an orphan Cognito
user — the rollback handler catches most cases but a hard OOM or
timeout can still slip through. Acceptable for Phase 2; a future
cleanup script can reconcile by diffing Cognito users vs DynamoDB
USER records on a schedule.
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
from contexts.user.domain.entities import User
from contexts.user.domain.value_objects import SystemRole
from contexts.user.infrastructure.mapper import UserMapper
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

    `cognito_service` is required for production; may be None in unit
    tests that only exercise the DynamoDB writes and rollback paths.
    """

    def __init__(self, cognito_service=None) -> None:
        self._table = get_table()
        self._cognito = cognito_service

    def execute(self, req: SignupRequest) -> dict:
        slug = req.slug.strip().lower()
        org_name = req.org_name.strip()
        owner_email = req.owner_email.strip().lower()
        owner_name = req.owner_name.strip()
        self._validate(slug, org_name, owner_email, owner_name, req.password)

        org_id = f"org_{uuid.uuid4().hex[:16]}"
        now = datetime.now(timezone.utc).isoformat()

        # Step 1: claim the slug atomically. Only this write uses a
        # ConditionExpression, because it is the one race-sensitive
        # operation: two simultaneous signups for the same slug collide
        # here and exactly one wins.
        try:
            self._table.put_item(
                Item=OrgMapper.slug_record(org_id, slug, now),
                ConditionExpression="attribute_not_exists(PK)",
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise ValidationError(f"Workspace code '{slug}' is already taken.")
            raise

        # Step 2: create the Cognito user. We need the Cognito-returned
        # `sub` to use as our internal user_id, so this must run before
        # the DynamoDB writes that reference owner_user_id.
        if self._cognito is None:
            # Unit-test path: fabricate a fake sub so the rest of the
            # use case can run without a live Cognito client.
            owner_user_id = f"test_{uuid.uuid4().hex[:16]}"
        else:
            try:
                owner_user_id = self._cognito.create_user_with_password(
                    email=owner_email,
                    name=owner_name,
                    password=req.password,
                    org_id=org_id,
                    system_role=SystemRole.OWNER.value,
                )
            except Exception:
                # Cognito failed. Roll back the slug claim.
                self._rollback_slug(slug)
                raise

        # Step 3: compose the DynamoDB records.
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
        owner_user = User.create(
            user_id=owner_user_id,
            email=owner_email,
            name=owner_name,
            system_role=SystemRole.OWNER,
        )
        role_records = [
            _role_record(org_id, OWNER_ROLE_ID, "Owner", now),
            _role_record(org_id, ADMIN_ROLE_ID, "Admin", now),
            _role_record(org_id, MEMBER_ROLE_ID, "Member", now),
        ]

        # Step 4: write everything to DynamoDB. On any failure, roll
        # back the Cognito user AND the slug record.
        try:
            self._table.put_item(Item=OrgMapper.org_to_dynamo(org))
            self._table.put_item(Item=OrgMapper.settings_to_dynamo(settings))
            self._table.put_item(Item=OrgMapper.plan_to_dynamo(plan))
            for role in role_records:
                self._table.put_item(Item=role)
            self._table.put_item(Item=UserMapper.to_dynamo(owner_user, org_id))
        except Exception:
            self._rollback_all(org_id, slug, owner_email)
            raise

        return {
            "org_id": org_id,
            "slug": slug,
            "name": org_name,
            "owner_user_id": owner_user_id,
            "redirect_url": f"/login?workspace={slug}&first_login=1",
        }

    def _validate(
        self,
        slug: str,
        org_name: str,
        owner_email: str,
        owner_name: str,
        password: str,
    ) -> None:
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
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters.")

    def _rollback_slug(self, slug: str) -> None:
        try:
            self._table.delete_item(
                Key={
                    "PK": tenant_keys.slug_pk(slug),
                    "SK": tenant_keys.slug_sk(),
                }
            )
        except Exception:
            pass

    def _rollback_all(self, org_id: str, slug: str, owner_email: str) -> None:
        """Best-effort cleanup after a Cognito create has succeeded but
        DynamoDB writes have failed. Swallows all errors — this runs
        only when something has already failed."""
        # Delete Cognito user first so the email can be re-used on retry.
        if self._cognito is not None:
            try:
                self._cognito.rollback_user(owner_email)
            except Exception:
                pass
        # Delete any DynamoDB records we wrote.
        try:
            with self._table.batch_writer() as batch:
                for sk in (
                    tenant_keys.org_sk(),
                    tenant_keys.settings_sk(),
                    tenant_keys.plan_sk(),
                    tenant_keys.role_sk(OWNER_ROLE_ID),
                    tenant_keys.role_sk(ADMIN_ROLE_ID),
                    tenant_keys.role_sk(MEMBER_ROLE_ID),
                ):
                    batch.delete_item(
                        Key={"PK": tenant_keys.org_pk(org_id), "SK": sk}
                    )
                batch.delete_item(
                    Key={
                        "PK": tenant_keys.slug_pk(slug),
                        "SK": tenant_keys.slug_sk(),
                    }
                )
        except Exception:
            pass


def _role_record(org_id: str, role_id: str, name: str, now: str) -> dict:
    """Default role record. Empty permission set for Phase 2; Phase 4
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
