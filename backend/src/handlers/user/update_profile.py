import os
from datetime import datetime, timezone
from typing import Optional

import boto3
from pydantic import BaseModel

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from shared.errors import NotFoundError

cognito_client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    skills: Optional[list[str]] = None
    date_of_birth: Optional[str] = None
    college_name: Optional[str] = None
    area_of_interest: Optional[str] = None
    hobby: Optional[str] = None
    company_prefix: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateProfileRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        user = user_repo.find_by_id(auth.user_id)
        if not user:
            raise NotFoundError(f"User {auth.user_id} not found")

        from domain.user.entities import User

        new_name = body.name if body.name is not None else user.name

        updated_user = User(
            user_id=user.user_id,
            employee_id=user.employee_id,
            email=user.email,
            name=new_name,
            system_role=user.system_role,
            created_by=user.created_by,
            phone=body.phone if body.phone is not None else user.phone,
            designation=body.designation if body.designation is not None else user.designation,
            department=user.department,
            location=body.location if body.location is not None else user.location,
            bio=body.bio if body.bio is not None else user.bio,
            avatar_url=body.avatar_url if body.avatar_url is not None else user.avatar_url,
            skills=body.skills if body.skills is not None else user.skills,
            date_of_birth=body.date_of_birth if body.date_of_birth is not None else user.date_of_birth,
            college_name=body.college_name if body.college_name is not None else user.college_name,
            area_of_interest=body.area_of_interest if body.area_of_interest is not None else user.area_of_interest,
            hobby=body.hobby if body.hobby is not None else user.hobby,
            company_prefix=body.company_prefix.upper().strip() if body.company_prefix is not None else user.company_prefix,
            created_at=user.created_at,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        user_repo.update(updated_user)

        # Sync name to Cognito so JWT reflects the change on next login
        if body.name is not None and body.name != user.name and USER_POOL_ID:
            try:
                cognito_client.admin_update_user_attributes(
                    UserPoolId=USER_POOL_ID,
                    Username=user.email,
                    UserAttributes=[{"Name": "name", "Value": new_name}],
                )
            except Exception:
                pass  # Non-critical — DynamoDB is the source of truth

        return build_success(200, updated_user.to_dict())
    except Exception as e:
        return build_error(e)
