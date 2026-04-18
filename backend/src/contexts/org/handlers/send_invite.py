"""Authed POST /orgs/current/invites — OWNER/ADMIN invites a user by email."""
import os

from contexts.org.application.invite_use_cases import (
    SendInviteRequest, SendInviteUseCase,
)
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.infrastructure.gmail_service import GmailEmailService
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


def handler(event, context):
    try:
        auth = extract_auth_context(event)
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
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
