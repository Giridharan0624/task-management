import json

from contexts.user.domain.entities import User
from contexts.user.domain.value_objects import SystemRole


class UserMapper:
    @staticmethod
    def to_domain(item: dict) -> User:
        skills_raw = item.get("skills", "[]")
        if isinstance(skills_raw, str):
            skills_raw = json.loads(skills_raw)
        if not isinstance(skills_raw, list):
            skills_raw = []

        return User(
            user_id=item.get("user_id") or item.get("userId", ""),
            employee_id=item.get("employee_id"),
            email=item.get("email", ""),
            name=item.get("name", ""),
            system_role=SystemRole(item.get("system_role") or item.get("systemRole", "MEMBER")),
            created_by=item.get("created_by"),
            phone=item.get("phone"),
            designation=item.get("designation"),
            department=item.get("department"),
            location=item.get("location"),
            bio=item.get("bio"),
            avatar_url=item.get("avatar_url"),
            skills=skills_raw,
            date_of_birth=item.get("date_of_birth"),
            college_name=item.get("college_name"),
            area_of_interest=item.get("area_of_interest"),
            hobby=item.get("hobby"),
            company_prefix=item.get("company_prefix"),
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
        if user.employee_id:
            item["employee_id"] = user.employee_id
            item["GSI2PK"] = f"EMPLOYEE#{user.employee_id}"
            item["GSI2SK"] = "PROFILE"
        if user.created_by:
            item["created_by"] = user.created_by
        if user.phone:
            item["phone"] = user.phone
        if user.designation:
            item["designation"] = user.designation
        if user.department:
            item["department"] = user.department
        if user.location:
            item["location"] = user.location
        if user.bio:
            item["bio"] = user.bio
        if user.avatar_url:
            item["avatar_url"] = user.avatar_url
        if user.skills:
            item["skills"] = json.dumps(user.skills)
        if user.date_of_birth:
            item["date_of_birth"] = user.date_of_birth
        if user.college_name:
            item["college_name"] = user.college_name
        if user.area_of_interest:
            item["area_of_interest"] = user.area_of_interest
        if user.hobby:
            item["hobby"] = user.hobby
        if user.company_prefix:
            item["company_prefix"] = user.company_prefix
        return item
