from shared_kernel.response import build_success, build_error
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.validate_body import validate_body
from shared_kernel import audit
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.infrastructure.cognito_service import CognitoService
from contexts.user.application.use_cases import UpdateUserRoleUseCase
from pydantic import BaseModel


class UpdateUserRoleRequest(BaseModel):
    user_id: str
    system_role: str


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(UpdateUserRoleRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        org_repo = OrgDynamoRepository()
        cognito_service = CognitoService()
        # org_repo + auth.org_id enable the use case to validate custom
        # role_ids against the tenant's live role records — without them
        # only the three built-in tiers (ADMIN / MEMBER) are accepted.
        use_case = UpdateUserRoleUseCase(
            user_repo,
            cognito_service,
            org_repo=org_repo,
            org_id=auth.org_id,
        )

        # Snapshot the user's previous role for the audit `before` field
        # BEFORE the use case mutates it. If the user doesn't exist the
        # use case will raise NotFoundError, so we read defensively.
        prev_user = user_repo.find_by_id(body.user_id)
        prev_role = prev_user.system_role if prev_user else ""

        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role)

        # Snapshot the role's permission set at the moment of assignment.
        # This makes the audit entry self-contained — if the OWNER later
        # edits or deletes the role, this record still explains what the
        # role granted when the change was made. Best-effort lookup; we
        # don't want to fail the request just because the metadata
        # snapshot couldn't load.
        new_role = result.get("system_role", "")
        snapshot_perms: list[str] = []
        try:
            role_record = org_repo.get_role(auth.org_id, new_role.lower())
            if role_record:
                snapshot_perms = role_record.get("permissions") or []
        except Exception:
            pass

        target_label = result.get("name") or result.get("email") or body.user_id
        audit.record(
            auth,
            action=audit.USER_ROLE_CHANGED,
            target={"type": "user", "id": body.user_id},
            summary=(
                f"Changed role of {target_label} from "
                f"{prev_role or '(unknown)'} to {new_role}"
            ),
            before={"system_role": prev_role},
            after={"system_role": new_role},
            metadata={
                # Snapshot the role's permission set so the audit log is
                # self-contained — see comment above.
                "role_permissions_at_assignment": snapshot_perms,
                "role_id": new_role,
            },
        )

        return build_success(200, result)
    except Exception as e:
        return build_error(e)
