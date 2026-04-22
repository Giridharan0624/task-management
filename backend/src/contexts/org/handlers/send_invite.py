"""Authed POST /orgs/current/invites — OWNER/ADMIN invites a user by email."""
import os

from contexts.org.application.invite_use_cases import (
    SendInviteRequest, SendInviteUseCase,
)
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.infrastructure.gmail_service import GmailEmailService
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require_email_verified, require_not_suspended
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # Block unverified-email users from inviting others — a signup
        # bot with a throwaway address shouldn't be able to seed the
        # tenant with more accounts.
        require_email_verified(auth)
        req = validate_body(SendInviteRequest, event.get("body"))

        use_case = SendInviteUseCase(
            org_repo=OrgDynamoRepository(),
            user_repo=UserDynamoRepository(),
            email_service=GmailEmailService,
        )
        result = use_case.execute(
            req=req,
            caller_user_id=auth.user_id,
            caller_system_role=auth.system_role,
            caller_org_id=auth.org_id,
            app_url=os.environ.get("APP_URL", ""),
        )
        audit.record(
            auth,
            action=audit.USER_INVITED,
            target={"type": "invite", "id": result.get("token", "")},
            summary=f"Invited {req.email} as {req.role_id}",
        )
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
