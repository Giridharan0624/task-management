import json
from typing import Optional

from contexts.org.domain.entities import Invite, Organization, OrgSettings, Plan
from contexts.org.domain.value_objects import OrgStatus, PlanTier
from shared_kernel import tenant_keys


class OrgMapper:
    # ------------------------------------------------------------------
    # Organization
    # ------------------------------------------------------------------
    @staticmethod
    def org_to_dynamo(org: Organization) -> dict:
        return {
            "PK": tenant_keys.org_pk(org.org_id),
            "SK": tenant_keys.org_sk(),
            "org_id": org.org_id,
            "slug": org.slug,
            "name": org.name,
            "owner_user_id": org.owner_user_id,
            "status": org.status.value,
            "plan_tier": org.plan_tier.value,
            "created_at": org.created_at,
            "updated_at": org.updated_at,
        }

    @staticmethod
    def org_to_domain(item: dict) -> Organization:
        return Organization(
            org_id=item["org_id"],
            slug=item["slug"],
            name=item["name"],
            owner_user_id=item.get("owner_user_id", ""),
            status=OrgStatus(item.get("status", OrgStatus.ACTIVE.value)),
            plan_tier=PlanTier(item.get("plan_tier", PlanTier.FREE.value)),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def slug_record(org_id: str, slug: str, created_at: str) -> dict:
        """The `PK=SLUG#{slug} SK=ORG` resolver item used by the public
        `GET /orgs/by-slug/{slug}` endpoint."""
        return {
            "PK": tenant_keys.slug_pk(slug),
            "SK": tenant_keys.slug_sk(),
            "slug": slug,
            "org_id": org_id,
            "created_at": created_at,
        }

    # ------------------------------------------------------------------
    # OrgSettings
    # ------------------------------------------------------------------
    @staticmethod
    def settings_to_dynamo(s: OrgSettings) -> dict:
        return {
            "PK": tenant_keys.org_pk(s.org_id),
            "SK": tenant_keys.settings_sk(),
            "org_id": s.org_id,
            "display_name": s.display_name,
            "logo_url": s.logo_url or "",
            "favicon_url": s.favicon_url or "",
            "primary_color": s.primary_color,
            "accent_color": s.accent_color,
            "terminology": json.dumps(s.terminology),
            "timezone": s.timezone,
            "locale": s.locale,
            "currency": s.currency,
            "week_start_day": s.week_start_day,
            "working_hours_start": s.working_hours_start,
            "working_hours_end": s.working_hours_end,
            "employee_id_prefix": s.employee_id_prefix,
            "features": json.dumps(s.features),
            "leave_types": json.dumps(s.leave_types),
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }

    @staticmethod
    def settings_to_domain(item: dict) -> OrgSettings:
        def _json_or(raw, default):
            if raw is None or raw == "":
                return default
            if isinstance(raw, str):
                try:
                    return json.loads(raw)
                except (ValueError, TypeError):
                    return default
            return raw

        return OrgSettings(
            org_id=item["org_id"],
            display_name=item.get("display_name", ""),
            logo_url=item.get("logo_url") or None,
            favicon_url=item.get("favicon_url") or None,
            primary_color=item.get("primary_color", "#4F46E5"),
            accent_color=item.get("accent_color", "#10B981"),
            terminology=_json_or(item.get("terminology"), {}),
            timezone=item.get("timezone", "Asia/Kolkata"),
            locale=item.get("locale", "en-IN"),
            currency=item.get("currency", "INR"),
            week_start_day=int(item.get("week_start_day", 1)),
            working_hours_start=item.get("working_hours_start", "09:00"),
            working_hours_end=item.get("working_hours_end", "18:00"),
            employee_id_prefix=item.get("employee_id_prefix", "EMP-"),
            features=_json_or(item.get("features"), {}),
            leave_types=_json_or(item.get("leave_types"), []),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    # ------------------------------------------------------------------
    # Plan
    # ------------------------------------------------------------------
    @staticmethod
    def plan_to_dynamo(p: Plan) -> dict:
        item: dict = {
            "PK": tenant_keys.org_pk(p.org_id),
            "SK": tenant_keys.plan_sk(),
            "org_id": p.org_id,
            "tier": p.tier.value,
            "features_allowed": json.dumps(sorted(p.features_allowed)),
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        # DynamoDB rejects None — only write limit fields when set
        if p.max_users is not None:
            item["max_users"] = p.max_users
        if p.max_projects is not None:
            item["max_projects"] = p.max_projects
        if p.retention_days is not None:
            item["retention_days"] = p.retention_days
        return item

    @staticmethod
    def plan_to_domain(item: dict) -> Plan:
        features_raw = item.get("features_allowed", "[]")
        if isinstance(features_raw, str):
            try:
                features = set(json.loads(features_raw))
            except (ValueError, TypeError):
                features = set()
        else:
            features = set(features_raw or [])
        return Plan(
            org_id=item["org_id"],
            tier=PlanTier(item.get("tier", PlanTier.FREE.value)),
            max_users=int(item["max_users"]) if item.get("max_users") is not None else None,
            max_projects=int(item["max_projects"]) if item.get("max_projects") is not None else None,
            retention_days=int(item["retention_days"]) if item.get("retention_days") is not None else None,
            features_allowed=features,
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    # ------------------------------------------------------------------
    # Invite
    # ------------------------------------------------------------------
    @staticmethod
    def invite_to_dynamo(i: Invite) -> dict:
        return {
            "PK": tenant_keys.org_pk(i.org_id),
            "SK": tenant_keys.invite_sk(i.token),
            "org_id": i.org_id,
            "token": i.token,
            "email": i.email,
            "role_id": i.role_id,
            "invited_by": i.invited_by,
            "expires_at": i.expires_at,
            "accepted_at": i.accepted_at or "",
            "created_at": i.created_at,
        }

    @staticmethod
    def invite_to_domain(item: dict) -> Invite:
        return Invite(
            org_id=item["org_id"],
            token=item["token"],
            email=item["email"],
            role_id=item["role_id"],
            invited_by=item["invited_by"],
            expires_at=item["expires_at"],
            accepted_at=item.get("accepted_at") or None,
            created_at=item["created_at"],
        )
