from dataclasses import dataclass

from infrastructure.dynamodb.user_repository import UserDynamoRepository


@dataclass
class AuthContext:
    user_id: str
    email: str
    system_role: str


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

    return AuthContext(
        user_id=user_id,
        email=claims.get("email", ""),
        system_role=db_role,
    )
