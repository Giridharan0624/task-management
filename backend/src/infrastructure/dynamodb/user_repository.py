from typing import Optional

from boto3.dynamodb.conditions import Attr, Key

from domain.user.entities import User
from domain.user.repository import IUserRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.user_mapper import UserMapper


class UserDynamoRepository(IUserRepository):
    def __init__(self):
        self._table = get_table()

    def find_by_id(self, user_id: str) -> Optional[User]:
        response = self._table.get_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}
        )
        item = response.get("Item")
        if not item:
            return None
        return UserMapper.to_domain(item)

    def find_by_email(self, email: str) -> Optional[User]:
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"USER_EMAIL#{email}")
            & Key("GSI1SK").eq("PROFILE"),
        )
        items = response.get("Items", [])
        if not items:
            return None
        return UserMapper.to_domain(items[0])

    def save(self, user: User) -> None:
        item = UserMapper.to_dynamo(user)
        self._table.put_item(Item=item)

    def update(self, user: User) -> None:
        item = UserMapper.to_dynamo(user)
        self._table.put_item(Item=item)

    def find_all(self) -> list[User]:
        response = self._table.scan(
            FilterExpression=Attr("SK").eq("PROFILE") & Attr("PK").begins_with("USER#")
        )
        items = response.get("Items", [])
        users = [UserMapper.to_domain(item) for item in items]

        # Handle pagination
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").eq("PROFILE") & Attr("PK").begins_with("USER#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            users.extend(UserMapper.to_domain(item) for item in response.get("Items", []))

        return users

    def find_by_employee_id(self, employee_id: str) -> Optional[User]:
        response = self._table.query(
            IndexName="GSI2",
            KeyConditionExpression=Key("GSI2PK").eq(f"EMPLOYEE#{employee_id}")
            & Key("GSI2SK").eq("PROFILE"),
        )
        items = response.get("Items", [])
        if not items:
            return None
        return UserMapper.to_domain(items[0])

    def get_next_employee_number(self) -> int:
        """Scan all users and find the highest employee number to generate next."""
        users = self.find_all()
        max_num = 0
        for u in users:
            if u.employee_id and u.employee_id.startswith("EMP-"):
                try:
                    num = int(u.employee_id.split("-")[1])
                    if num > max_num:
                        max_num = num
                except (ValueError, IndexError):
                    pass
        return max_num + 1

    def delete(self, user_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}
        )
