from dataclasses import dataclass

from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.tenant_keys import DEFAULT_ORG_ID


@dataclass
class AuthContext:
    user_id: str
    email: str
    system_role: str
    org_id: str = DEFAULT_ORG_ID


def extract_auth_context(event: dict) -> AuthContext:
    claims = (
        event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    )
    user_id = claims.get("sub", "")

    # Read the authoritative role from DynamoDB (not JWT) so role changes
    # take effect immediately without requiring re-login.
    jwt_role = claims.get("custom:systemRole", "MEMBER")
    db_role = jwt_role
    try:
        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(user_id)
        if user:
            db_role = user.system_role.value
    except Exception:
        pass  # Fall back to JWT role on any DB error

    # org_id comes from the Cognito custom attribute (immutable after user
    # creation, so a JWT read is authoritative). Pre-Phase-1 cutover the
    # claim will not exist on existing tokens, so we default to NEUROSTACK.
    org_id = claims.get("custom:orgId") or DEFAULT_ORG_ID

    return AuthContext(
        user_id=user_id,
        email=claims.get("email", ""),
        system_role=db_role,
        org_id=org_id,
    )
