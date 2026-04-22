"""PATCH /platform/orgs/{orgId}/features — platform-operator flag toggle.

Lets a platform operator flip `OrgSettings.features` flags on a
target tenant without requiring the tenant's OWNER to log in. Use
case: enable a hidden/experimental feature for one design-partner
tenant ahead of general availability, or emergency-disable a
feature that's misbehaving for one tenant.

Access control: same env-allowlist gate as the suspension endpoint
(`PLATFORM_ADMIN_USER_IDS`). Fail-closed when unset.

Request body: `{"features": {"key1": true, "key2": false}}` — a
partial map. Keys in the body are merged into the target's existing
`OrgSettings.features`; keys absent from the body are left untouched.

Audits the change under the TARGET org's timeline so the tenant can
see that a platform operator touched their settings.
"""
from __future__ import annotations

import os

from pydantic import BaseModel

from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class SetFeaturesRequest(BaseModel):
    features: dict[str, bool]


def _require_platform_admin(user_id: str) -> None:
    raw = os.environ.get("PLATFORM_ADMIN_USER_IDS", "").strip()
    if not raw:
        raise AuthorizationError(
            "Platform admin endpoint not configured. "
            "Set PLATFORM_ADMIN_USER_IDS to enable.",
        )
    allowed = {s.strip() for s in raw.split(",") if s.strip()}
    if user_id not in allowed:
        raise AuthorizationError("Platform admin required.")


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        _require_platform_admin(auth.user_id)

        path = event.get("pathParameters") or {}
        target_org_id = (path.get("orgId") or "").strip()
        if not target_org_id:
            raise ValidationError("orgId path parameter is required.")

        req = validate_body(SetFeaturesRequest, event.get("body"))
        if not req.features:
            raise ValidationError("features dict must have at least one key.")

        repo = OrgDynamoRepository()
        org = repo.find_by_id(target_org_id)
        if not org:
            raise NotFoundError(f"Organization '{target_org_id}' not found.")
        settings = repo.get_settings(target_org_id)
        if not settings:
            raise NotFoundError(
                f"Settings for '{target_org_id}' not found.",
            )

        # Shallow merge — only overwrite the keys the caller specified.
        merged_features = {**(settings.features or {}), **req.features}
        before = dict(settings.features or {})
        updated_settings = settings.model_copy(update={
            "features": merged_features,
        })
        repo.save_settings(updated_settings)

        audit.record(
            auth,
            action="platform.features_updated",
            target={"type": "org", "id": target_org_id},
            summary=(
                f"Platform operator toggled features for {target_org_id}: "
                f"{', '.join(req.features.keys())}"
            ),
            before={"features": before},
            after={"features": merged_features},
        )
        return build_success(200, {
            "org_id": target_org_id,
            "features": merged_features,
        })
    except Exception as e:
        return build_error(e)
