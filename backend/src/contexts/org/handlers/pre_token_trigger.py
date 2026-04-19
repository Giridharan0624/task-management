"""Cognito pre-token-generation trigger — injects multi-tenant claims into
every ID token issued by the user pool.

**PURE function by design.** Cognito caps trigger execution at 5 seconds.
Anything that imports boto3 / pydantic / the DDD layers blows past that on
cold start and login fails with "Socket timeout while invoking Lambda".
Keep this module free of heavy imports and never touch the database.

Responsibilities:
  1. Ensure `custom:orgId` is present on every token. Signup/backfill set
     it on the Cognito user attribute; this handler just echoes it into
     the token claims. Falls back to `"neurostack"` for the edge case
     where the attribute is somehow missing.
  2. Echo `custom:systemRole` into the claims. The authoritative role
     lookup already happens in `shared_kernel.auth_context` on every
     authenticated request — we don't need to re-do it here.
  3. Phase 4: derive `custom:roleId` from `custom:systemRole` and inject
     into the token. role_id is the canonical lowercase form
     (owner/admin/member); shared_kernel.permissions.require() resolves
     it against the per-tenant Role records to produce the permission set.
     We derive instead of reading a separate Cognito attribute because
     adding a new schema attribute to a deployed user pool requires an
     out-of-CDK admin call — derivation costs nothing and stays in sync
     by construction.

Event shape (simplified):
  event['request']['userAttributes']['custom:orgId']       — set by signup / backfill
  event['request']['userAttributes']['custom:systemRole']  — kept in sync by update_user_role

Response shape:
  event['response']['claimsOverrideDetails']['claimsToAddOrOverride']
    = { 'custom:orgId': '...', 'custom:systemRole': '...', 'custom:roleId': '...' }
"""

DEFAULT_ORG_ID = "neurostack"


def handler(event, context):
    user_attrs = (event or {}).get("request", {}).get("userAttributes", {}) or {}

    org_id = user_attrs.get("custom:orgId") or DEFAULT_ORG_ID
    system_role = user_attrs.get("custom:systemRole") or "MEMBER"
    # Canonical lowercase role_id matches the Phase 4 default_roles ID
    # constants (OWNER_ROLE_ID="owner" etc). require() also accepts the
    # uppercase enum form, so this stays compatible with any handler that
    # still reads `system_role` directly.
    role_id = (system_role or "MEMBER").strip().lower() or "member"

    event["response"] = {
        "claimsOverrideDetails": {
            "claimsToAddOrOverride": {
                "custom:orgId": org_id,
                "custom:systemRole": system_role,
                "custom:roleId": role_id,
            },
            "claimsToSuppress": [],
        }
    }
    return event
