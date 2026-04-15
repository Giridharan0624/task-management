"""Cognito pre-token-generation trigger — injects multi-tenant claims into
every ID token issued by the user pool.

Runs on:
  - TokenGeneration_Authentication  (login)
  - TokenGeneration_RefreshTokens   (refresh)
  - TokenGeneration_NewPasswordChallenge
  - TokenGeneration_AuthenticateDevice

Responsibilities:
  1. Ensure `custom:orgId` is present on every token. New Phase 2 signups
     already set it via `admin_create_user`; existing NEUROSTACK users
     (pre-backfill) don't have it yet and fall back to "neurostack".
  2. Refresh `custom:systemRole` from DynamoDB on every token issue so
     role changes take effect on the next token refresh (without
     requiring a full re-login). This mirrors what auth_context.py does
     for backward compat, but shifts the DB hit off the hot request path.

Safety:
  - Never raise. A failing trigger blocks login. Any DynamoDB error falls
    back to the userAttributes values and still returns the event.
  - Idempotent. The trigger only overrides claims we own.

Event shape (simplified):
  event['request']['userAttributes']['sub']                — Cognito user ID
  event['request']['userAttributes']['custom:orgId']       — may be absent
  event['request']['userAttributes']['custom:systemRole']  — may be absent

Response shape:
  event['response']['claimsOverrideDetails']['claimsToAddOrOverride']
    = { 'custom:orgId': '...', 'custom:systemRole': '...' }
"""
from shared_kernel.tenant_keys import DEFAULT_ORG_ID


def handler(event, context):
    user_attrs = (event or {}).get("request", {}).get("userAttributes", {}) or {}
    sub = user_attrs.get("sub", "")

    # Phase 1 behavior:
    #   - org_id comes from the user's Cognito attribute when present
    #     (set by signup / backfill). Falls back to the default org for
    #     any existing NEUROSTACK user that predates the attribute.
    org_id = user_attrs.get("custom:orgId") or DEFAULT_ORG_ID

    #   - system_role is refreshed from DynamoDB on every token issue.
    #     Fall back to the claim on the user attributes, then MEMBER.
    system_role = user_attrs.get("custom:systemRole") or "MEMBER"
    try:
        # Import inside the handler so a DB failure during warmup doesn't
        # break the trigger import itself (Cognito would reject the login).
        from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository

        user = UserDynamoRepository().find_by_id(sub)
        if user:
            system_role = user.system_role.value
    except Exception:
        # Never block login on a DB error — the fallback is correct enough
        # to let the user in; downstream handlers still authorize via
        # auth_context.py which has its own DB fallback.
        pass

    event["response"] = {
        "claimsOverrideDetails": {
            "claimsToAddOrOverride": {
                "custom:orgId": org_id,
                "custom:systemRole": system_role,
            },
            "claimsToSuppress": [],
        }
    }
    return event
