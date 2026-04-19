from dataclasses import dataclass

from shared_kernel.tenant_keys import DEFAULT_ORG_ID, set_current_org_id


@dataclass
class AuthContext:
    user_id: str
    email: str
    system_role: str
    org_id: str = DEFAULT_ORG_ID
    # Phase 4 — canonical lowercase role identifier (owner/admin/member or
    # a tenant-defined custom role id). Defaults to system_role lowercased
    # so the Phase-4 require() helper works against tenants that haven't
    # been migrated yet.
    role_id: str = ""


def extract_auth_context(event: dict) -> AuthContext:
    claims = (
        event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    )
    user_id = claims.get("sub", "")

    # org_id comes from the Cognito custom attribute (set by signup /
    # backfill and injected into every ID token by the pre-token-generation
    # trigger). Missing claim falls back to NEUROSTACK so that any existing
    # legacy token without the claim still works during the Phase 1 window.
    org_id = claims.get("custom:orgId") or DEFAULT_ORG_ID

    # Propagate the org_id into the per-request ContextVar so that every
    # repository instantiated during this request automatically scopes its
    # reads/writes to the right tenant without handlers having to pass
    # `org_id=auth.org_id` to 55 different constructor call sites.
    set_current_org_id(org_id)

    # Read the authoritative role from DynamoDB (not JWT) so role changes
    # take effect immediately without requiring re-login. Imported inside
    # the function to avoid a circular import with UserDynamoRepository,
    # which itself imports this module's set_current_org_id via its
    # constructor.
    jwt_role = claims.get("custom:systemRole", "MEMBER")
    db_role = jwt_role
    try:
        from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(user_id)
        if user:
            db_role = user.system_role.value
    except Exception:
        pass  # Fall back to JWT role on any DB error

    # Phase 4: role_id claim is injected by the pre-token trigger from
    # custom:systemRole. If it's missing (legacy token before the trigger
    # update rolled out), derive it from the authoritative DB role so
    # require() still resolves the right permission set.
    role_id = (claims.get("custom:roleId") or db_role or "").strip().lower()

    return AuthContext(
        user_id=user_id,
        email=claims.get("email", ""),
        system_role=db_role,
        org_id=org_id,
        role_id=role_id,
    )
