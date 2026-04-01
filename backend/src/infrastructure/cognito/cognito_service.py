import os
import boto3

from domain.user.identity_service import IIdentityService

cognito_client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


class CognitoService(IIdentityService):
    @staticmethod
    def create_user(email: str, name: str, temp_password: str, system_role: str, employee_id: str = "") -> str:
        """Create a Cognito user and return their sub (userId)."""
        attrs = [
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "name", "Value": name},
            {"Name": "custom:systemRole", "Value": system_role},
        ]
        if employee_id:
            attrs.append({"Name": "custom:employeeId", "Value": employee_id})
        response = cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=temp_password,
            UserAttributes=attrs,
            MessageAction="SUPPRESS",
        )
        # Extract the sub attribute
        attrs = response["User"]["Attributes"]
        sub = next(a["Value"] for a in attrs if a["Name"] == "sub")
        return sub

    @staticmethod
    def delete_user(email: str) -> None:
        """Delete a Cognito user by email/username."""
        try:
            cognito_client.admin_delete_user(
                UserPoolId=USER_POOL_ID,
                Username=email,
            )
        except cognito_client.exceptions.UserNotFoundException:
            # User doesn't exist in Cognito — proceed with DynamoDB cleanup
            pass

    @staticmethod
    def update_user_role(email: str, system_role: str) -> None:
        """Update the custom:systemRole attribute in Cognito."""
        cognito_client.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "custom:systemRole", "Value": system_role},
            ],
        )
