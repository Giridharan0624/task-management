"""DELETE /orgs/current/roles/{roleId} — remove a custom role.

System roles (owner/admin/member) cannot be deleted — they back the
existing SystemRole enum and removing one would orphan every user with
that role. Custom roles can be removed once no user references them;
this handler does NOT cascade or reassign — that's a deliberate guardrail
so an admin can't wipe out roles in active use without first reassigning
the affected users.
"""
from contexts.org.domain import permissions as P
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import (
    invalidate_role_cache,
    require,
    require_not_suspended,
)
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        # Email-verified gate intentionally omitted — see create_role.py.
        require(auth, P.ROLE_MANAGE)

        path = event.get("pathParameters") or {}
        role_id = (path.get("roleId") or "").strip().lower()
        if not role_id:
            raise ValidationError("roleId is required in the path.")

        repo = OrgDynamoRepository()
        existing = repo.get_role(auth.org_id, role_id)
        if existing is None:
            raise NotFoundError("Role not found.")
        if existing.get("is_system"):
            raise ValidationError(
                "System roles (owner/admin/member) cannot be deleted."
            )

        # Block deletion when any user still references this role.
        # Without this guard, the deleted role's id stays on user
        # records, the permission resolver falls through to the empty
        # set, and those users effectively become read-only with no
        # warning. Caller must reassign first via /admin/users.
        user_repo = UserDynamoRepository(org_id=auth.org_id)
        all_users = user_repo.find_all()
        # Case-insensitive match — DDB stores OWNER/ADMIN/MEMBER upper
        # but custom roles lowercase, and `role_id` here is lowercased.
        referenced_by = [
            u for u in all_users if (u.system_role or "").lower() == role_id
        ]
        if referenced_by:
            sample = ", ".join(
                (u.name or u.email) for u in referenced_by[:3]
            )
            more = (
                f" and {len(referenced_by) - 3} more"
                if len(referenced_by) > 3
                else ""
            )
            raise ValidationError(
                f"Role '{existing.get('name', role_id)}' is still assigned to "
                f"{len(referenced_by)} user(s) ({sample}{more}). "
                f"Reassign them to a different role before deleting."
            )

        repo.delete_role(auth.org_id, role_id)
        invalidate_role_cache(auth.org_id)
        audit.record(
            auth,
            action=audit.ROLE_DELETED,
            target={"type": "role", "id": role_id},
            summary=f"Deleted role '{existing.get('name', role_id)}'",
            before=existing,
        )
        return build_success(200, {"role_id": role_id, "deleted": True})
    except Exception as e:
        return build_error(e)
