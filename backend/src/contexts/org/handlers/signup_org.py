"""Public POST /signup handler.

Creates a new Organization + its first OWNER user. No Cognito
authorization required — this is how new tenants onboard themselves.

During Phase 1 the Cognito service is not yet wired in; the handler runs
the DynamoDB half of the signup only and returns the redirect URL. When
Phase 2 adds the invite flow we'll plug in the real CognitoService.
"""
from contexts.org.application.create_organization import (
    CreateOrganizationUseCase, SignupRequest,
)
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


def handler(event, context):
    try:
        req = validate_body(SignupRequest, event.get("body"))
        use_case = CreateOrganizationUseCase(cognito_service=None)
        result = use_case.execute(req)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
