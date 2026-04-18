import os
import boto3

from contexts.user.domain.identity_service import IIdentityService

cognito_client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


class CognitoService(IIdentityService):
    @staticmethod
    def create_user(email: str, name: str, temp_password: str, system_role: str, employee_id: str = "") -> str:
        """Create a Cognito user with a TEMPORARY password and return their sub (userId).

        Legacy admin-creates-a-user flow. The user receives a welcome email
        with the temp password and must change it on first login.
        """
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
        attrs = response["User"]["Attributes"]
        sub = next(a["Value"] for a in attrs if a["Name"] == "sub")
        return sub

    @staticmethod
    def create_user_with_password(
        email: str,
        name: str,
        password: str,
        org_id: str,
        system_role: str,
        employee_id: str = "",
    ) -> str:
        """Create a Cognito user with a PERMANENT password set in one shot.

        Used by:
          - signup (org OWNER, chose their own password on the form)
          - invite acceptance (invited user, chose their own password)

        Workflow:
          1. admin_create_user with the password as TemporaryPassword + SUPPRESS
             (we never want Cognito's default welcome email to fire)
          2. admin_set_user_password with Permanent=True so the user skips
             the FORCE_CHANGE_PASSWORD state and can log in immediately

        Returns the Cognito sub (used as our internal user_id).
        """
        attrs = [
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "name", "Value": name},
            {"Name": "custom:orgId", "Value": org_id},
            {"Name": "custom:systemRole", "Value": system_role},
        ]
        if employee_id:
            attrs.append({"Name": "custom:employeeId", "Value": employee_id})

        response = cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=password,  # required by API; overridden by set_password below
            UserAttributes=attrs,
            MessageAction="SUPPRESS",
        )
        sub = next(a["Value"] for a in response["User"]["Attributes"] if a["Name"] == "sub")

        # Promote temp password to permanent so the user can sign in
        # immediately without a FORCE_CHANGE_PASSWORD challenge.
        cognito_client.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=email,
            Password=password,
            Permanent=True,
        )
        return sub

    @staticmethod
    def rollback_user(email: str) -> None:
        """Best-effort: delete a Cognito user by email. Used when a
        multi-step signup/invite-accept fails after Cognito create
        succeeded, to leave the system in a clean state.
        """
        try:
            cognito_client.admin_delete_user(
                UserPoolId=USER_POOL_ID,
                Username=email,
            )
        except Exception:
            pass

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
