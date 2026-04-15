from typing import Optional

from boto3.dynamodb.conditions import Attr, Key

from contexts.user.domain.entities import User
from contexts.user.domain.repository import IUserRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id
from shared_kernel import tenant_keys
from contexts.user.infrastructure.mapper import UserMapper


class UserDynamoRepository(IUserRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        # Resolve org_id lazily from the per-request ContextVar set by
        # extract_auth_context(). Pre-auth handlers pass an explicit value.
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def find_by_id(self, user_id: str) -> Optional[User]:
        response = self._table.get_item(
            Key={
                "PK": tenant_keys.user_pk(self._org_id, user_id),
                "SK": tenant_keys.user_sk(),
            }
        )
        item = response.get("Item")
        if not item:
            return None
        return UserMapper.to_domain(item)

    def find_by_email(self, email: str) -> Optional[User]:
        # GSI1 `USER_EMAIL#{email}` is global — email is globally unique
        # (Cognito alias). Dual-write creates two items sharing this GSI
        # key (legacy + v2). Prefer the v2 item when both exist so that
        # callers that mutate based on PK target the org-scoped record.
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(tenant_keys.user_email_gsi1pk(email))
            & Key("GSI1SK").eq(tenant_keys.user_email_gsi1sk()),
        )
        items = response.get("Items", [])
        if not items:
            return None
        for item in items:
            if item.get("PK", "").startswith("ORG#"):
                return UserMapper.to_domain(item)
        return UserMapper.to_domain(items[0])

    def save(self, user: User) -> None:
        self._table.put_item(Item=UserMapper.to_dynamo(user, self._org_id))

    def update(self, user: User) -> None:
        self._table.put_item(Item=UserMapper.to_dynamo(user, self._org_id))

    def find_all(self) -> list[User]:
        org_prefix = f"ORG#{self._org_id}#USER#"
        response = self._table.scan(
            FilterExpression=Attr("SK").eq(tenant_keys.user_sk())
            & Attr("PK").begins_with(org_prefix)
        )
        items = response.get("Items", [])
        users = [UserMapper.to_domain(item) for item in items]

        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").eq(tenant_keys.user_sk())
                & Attr("PK").begins_with(org_prefix),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            users.extend(UserMapper.to_domain(item) for item in response.get("Items", []))

        return users

    def find_by_employee_id(self, employee_id: str) -> Optional[User]:
        response = self._table.query(
            IndexName="GSI2",
            KeyConditionExpression=Key("GSI2PK").eq(
                tenant_keys.employee_gsi2pk(self._org_id, employee_id)
            )
            & Key("GSI2SK").eq(tenant_keys.employee_gsi2sk()),
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
        self._table.delete_item(
            Key={"PK": tenant_keys.user_pk(self._org_id, user_id), "SK": "PROFILE"}
        )
