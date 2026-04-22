"""Public POST /signup handler.

Creates a new Organization, its first OWNER Cognito user, and the
owner's DynamoDB User profile. All-or-nothing with rollback.

Captcha guard runs first. When HCAPTCHA_SECRET is set, a bad/missing
token rejects before any Cognito or DynamoDB work happens. WAF already
rate-limits /signup per IP; captcha adds bot-detection on top of that.
"""
from contexts.org.application.create_organization import (
    CreateOrganizationUseCase, SignupRequest,
)
from contexts.user.infrastructure.cognito_service import CognitoService
from shared_kernel.captcha import verify_captcha
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


def handler(event, context):
    try:
        req = validate_body(SignupRequest, event.get("body"))
        verify_captcha(req.captcha_token)
        use_case = CreateOrganizationUseCase(cognito_service=CognitoService)
        result = use_case.execute(req)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
