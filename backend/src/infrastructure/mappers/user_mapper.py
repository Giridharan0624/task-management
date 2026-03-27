from domain.user.entities import User
from domain.user.value_objects import SystemRole


class UserMapper:
    @staticmethod
    def to_domain(item: dict) -> User:
        return User(
            user_id=item.get("user_id") or item.get("userId", ""),
            email=item.get("email", ""),
            name=item.get("name", ""),
            system_role=SystemRole(item.get("system_role") or item.get("systemRole", "MEMBER")),
            created_by=item.get("created_by"),
            created_at=item.get("created_at") or item.get("createdAt", ""),
            updated_at=item.get("updated_at") or item.get("updatedAt", ""),
        )

    @staticmethod
    def to_dynamo(user: User) -> dict:
        item = {
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
        if user.created_by:
            item["created_by"] = user.created_by
        return item
