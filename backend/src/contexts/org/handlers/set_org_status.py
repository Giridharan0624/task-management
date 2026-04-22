"""POST /platform/orgs/{orgId}/status — platform-operator only.

Flips an org between ACTIVE and SUSPENDED. Deliberately separated from
tenant-facing handlers because a tenant OWNER suspending their own
workspace is a footgun (they lock themselves out, then can't un-suspend
because every mutation path calls `require_not_suspended` first).

Access control: the caller's `sub` (user_id) must appear in the
`PLATFORM_ADMIN_USER_IDS` env var (comma-separated list of Cognito
user sub IDs). If the env var is unset or empty, the endpoint refuses
ALL requests — fail-closed is the only safe default for a lever this
sharp.

Behavior:
  - Body: {"status": "ACTIVE" | "SUSPENDED", "reason": "..." (optional)}
  - Updates Org record, invalidates per-org permission cache so
    subsequent `require_not_suspended` calls re-read fresh state
  - Audits the action (platform operator identity is the actor)
  - Returns the updated org.

Observability: emits to the audit log under the TARGET org, not the
operator's org, so the tenant's own timeline shows the suspension.
"""
from __future__ import annotations

import os

from pydantic import BaseModel, Field

from contexts.org.domain.value_objects import OrgStatus
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import AuthContext, extract_auth_context
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import invalidate_role_cache
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class SetOrgStatusRequest(BaseModel):
    status: str = Field(pattern="^(ACTIVE|SUSPENDED)$")
    reason: str | None = None


def _platform_admin_ids() -> set[str]:
    raw = os.environ.get("PLATFORM_ADMIN_USER_IDS", "").strip()
    if not raw:
        return set()
    return {s.strip() for s in raw.split(",") if s.strip()}


def _require_platform_admin(auth: AuthContext) -> None:
    allowed = _platform_admin_ids()
    if not allowed:
        # Fail-closed: if the allowlist is empty, nobody can suspend.
        raise AuthorizationError(
            "Suspension endpoint not configured. "
            "Set PLATFORM_ADMIN_USER_IDS to enable.",
        )
    if auth.user_id not in allowed:
        raise AuthorizationError("Platform admin required.")


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        _require_platform_admin(auth)

        path = event.get("pathParameters") or {}
        target_org_id = (path.get("orgId") or "").strip()
        if not target_org_id:
            raise ValidationError("orgId path parameter is required.")

        req = validate_body(SetOrgStatusRequest, event.get("body"))

        repo = OrgDynamoRepository()
        org = repo.find_by_id(target_org_id)
        if not org:
            raise NotFoundError(f"Organization '{target_org_id}' not found.")

        new_status = OrgStatus(req.status)
        if org.status == new_status:
            # Idempotent — still audit so operators can see the no-op attempt.
            audit.record(
                auth,
                action=(
                    audit.ORG_SUSPENDED if new_status == OrgStatus.SUSPENDED
                    else audit.ORG_RESUMED
                ),
                target={"type": "org", "id": target_org_id},
                summary=f"No-op: org already {new_status.value}",
                metadata={"reason": req.reason or "", "no_op": True},
            )
            return build_success(200, {"org": org.to_dict(), "no_op": True})

        updated = (
            org.suspend() if new_status == OrgStatus.SUSPENDED
            else org.reactivate()
        )
        repo.save(updated)
        # Any cached role permissions for this tenant must be dropped so
        # a suspended-then-resumed org doesn't keep a stale "blocked" view
        # for the next few minutes of warm-Lambda invocations.
        invalidate_role_cache(target_org_id)

        audit.record(
            auth,
            action=(
                audit.ORG_SUSPENDED if new_status == OrgStatus.SUSPENDED
                else audit.ORG_RESUMED
            ),
            target={"type": "org", "id": target_org_id},
            summary=(
                f"Workspace {new_status.value.lower()} by platform operator"
            ),
            before={"status": org.status.value},
            after={"status": updated.status.value},
            metadata={"reason": req.reason or ""},
        )
        return build_success(200, {"org": updated.to_dict()})
    except Exception as e:
        return build_error(e)
