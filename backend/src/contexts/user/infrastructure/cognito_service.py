import os
import boto3

from contexts.user.domain.identity_service import IIdentityService

cognito_client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


class CognitoService(IIdentityService):
    @staticmethod
    def create_user(
        email: str,
        name: str,
        temp_password: str,
        system_role: str,
        org_id: str,
        employee_id: str = "",
    ) -> str:
        """Create a Cognito user with a TEMPORARY password and return their sub (userId).

        Legacy admin-creates-a-user flow. The user receives a welcome email
        with the temp password and must change it on first login.

        `org_id` is REQUIRED — without it the new Cognito user has no
        custom:orgId attribute, the pre-token-generation trigger falls
        back to DEFAULT_ORG_ID = "neurostack", and the user lands in the
        wrong tenant on first login (cross-tenant data leak).
        """
        if not org_id:
            raise ValueError("org_id is required to create a Cognito user")
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
        email_verified_flag: bool = True,
    ) -> str:
        """Create a Cognito user with a PERMANENT password set in one shot.

        Used by:
          - signup (org OWNER, chose their own password on the form)
          - invite acceptance (invited user, chose their own password)

        `email_verified_flag` defaults to True for backward compatibility
        with the invite flow: the invitee clicked a link that was emailed
        to that exact address, so receipt of the link IS the proof of
        ownership. Signup passes `False` — a stranger on the signup form
        has provided no such proof and must complete a code challenge
        before the account counts as real.

        Workflow:
          1. admin_create_user with the password as TemporaryPassword + SUPPRESS
             (we never want Cognito's default welcome email to fire)
          2. admin_set_user_password with Permanent=True so the user skips
             the FORCE_CHANGE_PASSWORD state and can log in immediately

        Returns the Cognito sub (used as our internal user_id).
        """
        attrs = [
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true" if email_verified_flag else "false"},
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
    def rollback_user(user_id: str) -> None:
        """Best-effort: delete a Cognito user by their `sub`. Used when a
        multi-step signup/invite-accept fails after Cognito create
        succeeded, to leave the system in a clean state.

        MUST be the `sub`, not the email: this runs immediately after
        `admin_create_user`, when the email alias index has often not
        propagated yet — a delete-by-email would raise UserNotFound and
        leave the login orphaned.
        """
        try:
            cognito_client.admin_delete_user(
                UserPoolId=USER_POOL_ID,
                Username=user_id,
            )
        except Exception:
            pass

    @staticmethod
    def delete_user(user_id: str) -> None:
        """Delete a Cognito user by their `sub` (the immutable Cognito
        username), NOT their email.

        Deleting by email is unsafe: the email→user alias index is
        eventually consistent, so for a recently-created user
        `admin_delete_user(Username=email)` can raise UserNotFound even
        though the user exists. That exception is swallowed below for
        idempotency, which would then orphan the Cognito login while the
        caller goes on to delete the DynamoDB profile. The `sub` never has
        this lag. (See the prod->v2 migration incident: 20 users created
        in a burst, then two deleted-by-email orphaned their logins.)
        """
        try:
            cognito_client.admin_delete_user(
                UserPoolId=USER_POOL_ID,
                Username=user_id,
            )
        except cognito_client.exceptions.UserNotFoundException:
            # Genuinely absent (sub is never subject to alias lag) —
            # proceed with DynamoDB cleanup.
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
