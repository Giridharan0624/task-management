"""Public POST /signup handler.

Creates a new Organization, its first OWNER Cognito user, and the
owner's DynamoDB User profile. All-or-nothing with rollback.

Self-service signup can be turned off per deployment via the
`signup_enabled` stage_config flag (env `SIGNUP_ENABLED`). This route is
`authorization_type=NONE`, so the gate MUST live here on the server —
hiding the UI is not a control. Defaults to enabled, so deployments that
don't set the flag (e.g. legacy prod) are unaffected.

Captcha guard runs next. When HCAPTCHA_SECRET is set, a bad/missing
token rejects before any Cognito or DynamoDB work happens. WAF already
rate-limits /signup per IP; captcha adds bot-detection on top of that.
"""
import os

from contexts.org.application.create_organization import (
    CreateOrganizationUseCase, SignupRequest,
)
from contexts.user.infrastructure.cognito_service import CognitoService
from shared_kernel.captcha import verify_captcha
from shared_kernel.errors import AuthorizationError
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body

SIGNUP_DISABLED_MESSAGE = (
    "Public signup is disabled. Ask an administrator to invite you."
)


def _signup_enabled() -> bool:
    return os.environ.get("SIGNUP_ENABLED", "1") == "1"


def handler(event, context):
    try:
        # Reject before any validation / captcha / Cognito / DynamoDB work.
        if not _signup_enabled():
            raise AuthorizationError(SIGNUP_DISABLED_MESSAGE)
        req = validate_body(SignupRequest, event.get("body"))
        verify_captcha(req.captcha_token)
        use_case = CreateOrganizationUseCase(cognito_service=CognitoService)
        result = use_case.execute(req)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
