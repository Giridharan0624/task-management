from domain.user.entities import User
from domain.user.value_objects import SystemRole


class UserMapper:
    @staticmethod
    def to_domain(item: dict) -> User:
        return User(
            user_id=item["user_id"],
            email=item["email"],
            name=item["name"],
            system_role=SystemRole(item["system_role"]),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def to_dynamo(user: User) -> dict:
        return {
            "PK": f"USER#{user.user_id}",
            "SK": "PROFILE",
            "GSI1PK": f"USER_EMAIL#{user.email}",
            "GSI1SK": "PROFILE",
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name,
            "system_role": user.system_role.value,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
