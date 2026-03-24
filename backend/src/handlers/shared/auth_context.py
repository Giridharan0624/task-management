from dataclasses import dataclass


@dataclass
class AuthContext:
    user_id: str
    email: str
    system_role: str


def extract_auth_context(event: dict) -> AuthContext:
    claims = (
        event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    )
    return AuthContext(
        user_id=claims.get("sub", ""),
        email=claims.get("email", ""),
        system_role=claims.get("custom:systemRole", "VIEWER"),
    )
