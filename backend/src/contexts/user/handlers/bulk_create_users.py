"""POST /users/bulk — create many users in one call.

Intended for admins onboarding a whole team from a CSV export of their
previous tool. The frontend parses the CSV, shows a preview, and posts
the parsed rows here.

Implementation detail: we reuse the single-user `CreateUserUseCase`
per row. That re-fetches the plan + user count on every row (wasteful
O(N) scans), but bulk import is infrequent and each row still needs
the full atomicity guarantees of the single-user path — separate
Cognito create, separate welcome email, separate audit record. Caller
sees a per-row result so partial success is clearly reported.

Request:
    {"users": [
        {"email": "a@x.com", "name": "Alice", "system_role": "MEMBER",
         "department": "Eng", "date_of_joining": "2026-01-15"},
        ...
    ]}

Response (200 always — row-level errors are in the `failed` array):
    {"created": [{"row": 1, "email": "a@x.com", "user_id": "...",
                  "employee_id": "NS-26AB12", "otp": "..."}],
     "failed":  [{"row": 2, "email": "b@x.com",
                  "error": "User with email b@x.com already exists"}]}

The response returns OTPs so the admin can redistribute manually if
the welcome-email SMTP fails (same pattern as single-user create). If
you're consuming this endpoint programmatically, strip OTPs from
logs.
"""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional

from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.application.use_cases import CreateUserUseCase
from contexts.user.infrastructure.cognito_service import CognitoService
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import AppError, ValidationError
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


# Soft ceiling so one request can't stall the Lambda or blow the
# welcome-email SMTP quota. If admins need to import >200 users,
# they chunk client-side.
MAX_ROWS_PER_REQUEST = 200


class BulkUserRow(BaseModel):
    email: str
    name: str
    system_role: str = "MEMBER"
    department: str = ""
    date_of_joining: str = ""


class BulkCreateUsersRequest(BaseModel):
    users: list[BulkUserRow] = Field(min_length=1, max_length=MAX_ROWS_PER_REQUEST)


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)

        body = validate_body(BulkCreateUsersRequest, event.get("body"))

        user_repo = UserDynamoRepository()
        org_repo = OrgDynamoRepository()
        cognito_service = CognitoService()
        use_case = CreateUserUseCase(user_repo, cognito_service, org_repo=org_repo)

        created: list[dict] = []
        failed: list[dict] = []

        for idx, row in enumerate(body.users, start=1):
            try:
                result = use_case.execute(
                    row.model_dump(),
                    auth.user_id,
                    auth.system_role,
                    auth.org_id,
                )
                created.append({
                    "row": idx,
                    "email": row.email,
                    "user_id": result.get("user_id", ""),
                    "employee_id": result.get("employee_id", ""),
                    "otp": result.get("otp", ""),
                })
                # One audit record per success — mirrors single-user create.
                audit.record(
                    auth,
                    action=audit.USER_CREATED,
                    target={"type": "user", "id": result.get("user_id", "")},
                    summary=f"Bulk-created user {row.email} ({row.system_role})",
                    metadata={"bulk": True, "row": idx},
                )
            except AppError as e:
                # Typed failure — surface the original message to the
                # admin so they can fix the row and retry just that one.
                failed.append({
                    "row": idx,
                    "email": row.email,
                    "error": e.message,
                })
            except Exception as e:
                # Untyped failure (usually a Cognito API hiccup). Keep
                # going — don't abort the whole import for one bad row.
                failed.append({
                    "row": idx,
                    "email": row.email,
                    "error": str(e) or "Unknown error",
                })

        return build_success(200, {
            "created": created,
            "failed": failed,
            "summary": {
                "requested": len(body.users),
                "created": len(created),
                "failed": len(failed),
            },
        })
    except Exception as e:
        return build_error(e)
