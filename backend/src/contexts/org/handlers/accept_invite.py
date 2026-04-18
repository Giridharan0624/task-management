"""Public POST /invites/{token}/accept — invited user sets password.

No auth on this endpoint because the JWT doesn't exist yet — the
accept-invite token itself is the auth credential. The token is URL-safe
random 32 bytes (~256 bits of entropy) and is invalidated after use.
"""
from contexts.org.application.invite_use_cases import (
    AcceptInviteRequest, AcceptInviteUseCase,
)
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.cognito_service import CognitoService
from shared_kernel.errors import NotFoundError
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


def handler(event, context):
    try:
        token = (event.get("pathParameters") or {}).get("token", "").strip()
        if not token:
            raise NotFoundError("Invite not found.")

        req = validate_body(AcceptInviteRequest, event.get("body"))

        use_case = AcceptInviteUseCase(
            org_repo=OrgDynamoRepository(),
            cognito_service=CognitoService,
        )
        result = use_case.execute(token=token, req=req)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
