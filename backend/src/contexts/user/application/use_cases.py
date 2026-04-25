from __future__ import annotations
import hashlib
import logging
import os
import secrets
import string
import uuid
from datetime import datetime, timezone

from contexts.org.domain import permissions as P
from contexts.project.domain.repository import IProjectRepository
from contexts.task.domain.repository import ITaskRepository
from contexts.user.domain.entities import User
from contexts.user.domain.identity_service import IIdentityService
from contexts.user.domain.repository import IUserRepository
from contexts.user.domain.value_objects import SystemRole
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import role_has


class ListUsersUseCase:
    """OWNER and ADMIN see all users."""
    def __init__(self, user_repo: IUserRepository):
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if not role_has(caller_system_role, P.USER_LIST):
            raise AuthorizationError("You don't have permission to view the user list.")
        users = self._user_repo.find_all()
        return [u.to_dict() for u in users]


class UpdateUserRoleUseCase:
    """Assign a user to any system-scope role defined by the tenant.

    Historically this use case only permitted ADMIN and MEMBER — the
    hardcoded `SystemRole` enum was the only acceptable target. Session 8
    relaxed that: the target role_id is validated against the tenant's
    DDB role records (`list_roles(org_id)` filtered by `scope="system"`)
    so custom roles created in /settings/roles can actually be assigned.

    Rules:
      - Only the OWNER can change user roles.
      - The OWNER role is immutable — cannot be granted or revoked
        through this path (use /orgs/current/transfer-ownership).
      - The target role_id must exist in the tenant's role records with
        `scope="system"`. Unknown role_ids are rejected.
      - Mixed-case input is accepted. Built-in tiers stay uppercase
        (OWNER/ADMIN/MEMBER) for backward compatibility with existing
        Cognito `custom:systemRole` values and DDB rows; custom roles
        are stored in their canonical lowercase form.
    """
    def __init__(
        self,
        user_repo: IUserRepository,
        identity_service: IIdentityService,
        org_repo=None,
        org_id: str = "",
    ):
        self._user_repo = user_repo
        self._cognito = identity_service
        self._org_repo = org_repo
        self._org_id = org_id

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        # Caller must hold `user.role.manage`. By default this resolves
        # to OWNER only (matching the pre-Session-8 behavior), but a
        # tenant-defined custom role that grants USER_ROLE_MANAGE can
        # change roles too — that's the whole point of the live
        # permission model. The OWNER role itself remains immutable
        # via the explicit reject below.
        if not role_has(caller_system_role, P.USER_ROLE_MANAGE):
            raise AuthorizationError("You don't have permission to change user roles.")

        target_user_id = dto["user_id"]
        new_role_raw = (dto.get("system_role") or "").strip()
        if not new_role_raw:
            raise ValidationError("system_role is required")

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        if (target_user.system_role or "").upper() == SystemRole.OWNER.value:
            raise AuthorizationError("The Owner role cannot be changed.")

        # Reject any attempt to promote to OWNER here. Ownership transfer
        # is a separate endpoint with its own invariants (demote current
        # owner to ADMIN, update org.owner_id, etc.).
        if new_role_raw.lower() == "owner":
            raise AuthorizationError("Users cannot be promoted to the Owner role.")

        # Resolve the canonical stored form. Built-in tiers stay upper-
        # case for compatibility; custom roles use the lowercase role_id
        # exactly as stored in DDB role records.
        canonical_role = self._resolve_canonical_role(new_role_raw)

        updated_user = target_user.model_copy(update={
            "system_role": canonical_role,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        self._user_repo.update(updated_user)
        # Cognito `custom:systemRole` mirrors the stored value; the
        # pre-token trigger lowercases it into `custom:roleId` for the
        # permission engine to consume.
        self._cognito.update_user_role(target_user.email, canonical_role)

        return updated_user.to_dict()

    def _resolve_canonical_role(self, raw: str) -> str:
        """Look up `raw` in the org's role records; return the canonical
        stored form. Raises ValidationError for unknown or wrong-scope
        role_ids. The three built-in tiers resolve to uppercase
        OWNER/ADMIN/MEMBER (matching legacy storage) even if `raw` came
        in lowercased."""
        if raw.upper() in (SystemRole.ADMIN.value, SystemRole.MEMBER.value):
            return raw.upper()

        if not self._org_repo or not self._org_id:
            # No role-repo access — preserve the pre-custom-role behavior
            # so unit tests that don't wire the org repo still work.
            raise ValidationError(f"Invalid target role: {raw}")

        roles = self._org_repo.list_roles(self._org_id)
        needle = raw.lower()
        for r in roles:
            if (r.get("role_id") or "").lower() != needle:
                continue
            if r.get("scope", "system") != "system":
                raise ValidationError(
                    f"Role '{raw}' is not a system-scope role and cannot be assigned to a user."
                )
            return r.get("role_id") or needle
        raise ValidationError(f"Invalid target role: {raw}")


class GetUserProgressUseCase:
    """OWNER and ADMIN can view anyone's progress."""
    def __init__(self, user_repo: IUserRepository, project_repo: IProjectRepository, task_repo: ITaskRepository):
        self._user_repo = user_repo
        self._project_repo = project_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if not role_has(caller_system_role, P.USER_VIEW_PROGRESS):
            raise AuthorizationError("You don't have permission to view user progress.")

        target_user_id = dto["user_id"]
        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        # Get all projects the target user belongs to
        projects = self._project_repo.find_projects_for_user(target_user_id)

        project_progress = []
        total_stats = {"TODO": 0, "IN_PROGRESS": 0, "DONE": 0, "total": 0}

        for project in projects:
            tasks = self._task_repo.find_by_project(project.project_id)
            # Filter tasks assigned to this user
            user_tasks = [t for t in tasks if target_user_id in t.assigned_to]

            stats = {"TODO": 0, "IN_PROGRESS": 0, "DONE": 0}
            for task in user_tasks:
                status_str = str(task.status)
                stats[status_str] = stats.get(status_str, 0) + 1

            project_progress.append({
                "project_id": project.project_id,
                "project_name": project.name,
                "tasks": [t.to_dict() for t in user_tasks],
                "stats": stats,
            })

            for key in ("TODO", "IN_PROGRESS", "DONE"):
                total_stats[key] += stats[key]
            total_stats["total"] += len(user_tasks)

        return {
            "user": target_user.to_dict(),
            "projects": project_progress,
            "total_stats": total_stats,
        }


class CreateUserUseCase:
    """
    Owner and Admins can create users.
    Members cannot create anyone.
    Nobody can create OWNER (use /orgs/current/transfer-ownership).

    Target role: the three built-in tiers (ADMIN/MEMBER) have always
    worked; Session 8 extended this to any scope="system" role defined
    in the tenant's /settings/roles so custom roles can be assigned at
    creation time, not just promoted to afterwards.

    Multi-tenant: every created user is scoped to the caller's org_id.
    The Cognito user gets `custom:orgId` set so they land in the right
    tenant on first login, and the User profile record is written via
    `user_repo` which is already org-scoped via the AuthContext ContextVar.
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: IIdentityService, org_repo=None):
        self._user_repo = user_repo
        self._cognito = cognito_service
        # Optional — used to read OrgSettings for branding AND to validate
        # custom role_ids against the tenant's role records.
        self._org_repo = org_repo

    @staticmethod
    def _generate_otp(length: int = 12) -> str:
        """Generate a secure one-time password meeting Cognito policy."""
        alphabet = string.ascii_uppercase + string.ascii_lowercase + string.digits
        while True:
            otp = ''.join(secrets.choice(alphabet) for _ in range(length))
            if (any(c.isupper() for c in otp) and
                any(c.islower() for c in otp) and
                any(c.isdigit() for c in otp)):
                return otp

    def execute(
        self,
        dto: dict,
        caller_user_id: str,
        caller_system_role: str,
        caller_org_id: str,
    ) -> dict:
        target_role_raw = (dto.get("system_role") or "MEMBER").strip()
        email = dto["email"]
        name = dto["name"]

        if not caller_org_id:
            raise ValidationError("Org context is missing.")

        # Reject any attempt to create an Owner here. The OWNER role is
        # only granted through org signup and the ownership-transfer flow.
        if target_role_raw.lower() == "owner":
            raise AuthorizationError("An Owner account cannot be created.")

        # Caller authorization. Only OWNER and ADMIN can create users —
        # custom roles whose permissions include user.create would bypass
        # this check via the handler-level `require(ctx, USER_CREATE)` gate
        # that already runs on the public entry point. Here we guard
        # against the legacy enum-only path where caller_system_role was
        # compared literally to the built-in tiers.
        caller_is_privileged = (
            caller_system_role in (SystemRole.OWNER.value, SystemRole.ADMIN.value)
            or role_has(caller_system_role, P.USER_CREATE)
        )
        if not caller_is_privileged:
            raise AuthorizationError("You don't have permission to create user accounts.")

        # Target role resolution. Uppercase ADMIN/MEMBER keep their legacy
        # stored form so existing DDB rows stay consistent; custom roles
        # use their canonical lowercase role_id. Any role not matching
        # one of the three built-in tiers is validated against the org's
        # live role records — same pattern as UpdateUserRoleUseCase.
        target_role = self._resolve_target_role(target_role_raw, caller_org_id)

        # Plan limit: refuse if existing user count + pending invites would exceed max_users
        if self._org_repo is not None:
            plan = self._org_repo.get_plan(caller_org_id)
            if plan and plan.max_users is not None:
                existing_count = len(self._user_repo.find_all())
                pending_invites = sum(
                    1 for i in self._org_repo.list_invites(caller_org_id)
                    if not i.accepted_at
                )
                if existing_count + pending_invites >= plan.max_users:
                    raise ValidationError(
                        f"Your {plan.tier.value} plan is limited to "
                        f"{plan.max_users} users. Upgrade to add more."
                    )

        # Check if email already exists
        existing = self._user_repo.find_by_email(email)
        if existing:
            raise ValidationError(f"User with email {email} already exists")

        # Resolve the org's employee-ID prefix from OrgSettings (Phase 3),
        # falling back to the OWNER's per-user company_prefix for legacy
        # tenants that haven't customized it yet, then to "NS" as the
        # original NEUROSTACK default.
        company_prefix = "NS"
        if self._org_repo is not None:
            settings = self._org_repo.get_settings(caller_org_id)
            if settings and settings.employee_id_prefix:
                # Strip the trailing "-" if present (default is "EMP-")
                company_prefix = settings.employee_id_prefix.rstrip("-").upper() or "NS"
        if company_prefix == "NS":
            # Backward-compat fallback for tenants without OrgSettings yet
            all_users_for_prefix = self._user_repo.find_all()
            owner = next((u for u in all_users_for_prefix if u.system_role == SystemRole.OWNER), None)
            company_prefix = (owner.company_prefix if owner and owner.company_prefix else "NS").upper()
        else:
            owner = None  # will resolve below if email needs the company name

        # Generate employee ID: PREFIX-YYHASH (e.g., NS-26AK76)
        year = datetime.now(timezone.utc).strftime("%y")
        hash_hex = hashlib.sha256(email.lower().encode()).hexdigest().upper()
        hash_chars = ''.join(c for c in hash_hex if c.isalnum())[:4]
        employee_id = f"{company_prefix}-{year}{hash_chars}"

        # Collision handling — append extra hash chars if needed
        if self._user_repo.find_by_employee_id(employee_id):
            for extra in range(4, 8):
                candidate = f"{company_prefix}-{year}{''.join(c for c in hash_hex if c.isalnum())[:extra + 1]}"
                if not self._user_repo.find_by_employee_id(candidate):
                    employee_id = candidate
                    break
            else:
                raise ValidationError("Could not generate a unique employee ID. Please try again.")

        # Generate one-time password
        otp = self._generate_otp()

        # Create in Cognito with OTP as temporary password.
        # User will be in FORCE_CHANGE_PASSWORD state. Cognito user gets
        # custom:orgId set so they land in the right tenant on first login.
        try:
            user_id = self._cognito.create_user(
                email=email,
                name=name,
                temp_password=otp,
                system_role=target_role,
                org_id=caller_org_id,
                employee_id=employee_id,
            )
        except Exception as e:
            raise ValidationError(str(e))

        # Create in DynamoDB. Plain string here — User.system_role is
        # no longer enum-typed, so custom role_ids pass through.
        user = User.create(
            user_id=user_id,
            email=email,
            name=name,
            system_role=target_role,
            created_by=caller_user_id,
            employee_id=employee_id,
        )
        # Set department and date of joining at creation time
        overrides: dict = {}
        if dto.get("department"):
            overrides["department"] = dto["department"]
        if dto.get("date_of_joining"):
            overrides["created_at"] = dto["date_of_joining"]
        if overrides:
            user = User(**{**user.model_dump(), **overrides})
        self._user_repo.save(user)

        # Send welcome email with OTP (non-critical — don't fail user creation)
        try:
            from contexts.user.infrastructure.gmail_service import GmailEmailService
            app_url = os.environ.get("APP_URL", "")

            # Use the org's display_name as the company name in the email
            # (Phase 3 branding — falls back to legacy OWNER.name then
            # "TaskFlow" if neither is available).
            company_name = "TaskFlow"
            if self._org_repo is not None:
                settings = self._org_repo.get_settings(caller_org_id)
                if settings and settings.display_name:
                    company_name = settings.display_name
            if company_name == "TaskFlow" and owner is not None:
                company_name = owner.name or "TaskFlow"

            GmailEmailService.send_welcome_email(
                recipient_email=email,
                recipient_name=name,
                employee_id=employee_id,
                otp=otp,
                app_url=app_url,
                role=target_role,
                department=dto.get("department", ""),
                company_name=company_name,
            )
        except Exception:
            logging.getLogger(__name__).warning(
                "Failed to send welcome email to %s", email, exc_info=True
            )

        result = user.to_dict()
        result["otp"] = otp  # Return OTP in response so admin can share if email fails
        return result

    def _resolve_target_role(self, raw: str, org_id: str) -> str:
        """Mirror of UpdateUserRoleUseCase._resolve_canonical_role — kept
        duplicated rather than extracted because the two live in
        different domain areas and their error messages differ. Built-in
        tiers resolve to uppercase ADMIN/MEMBER for legacy compatibility;
        custom roles to their stored (lowercase) role_id."""
        if raw.upper() in (SystemRole.ADMIN.value, SystemRole.MEMBER.value):
            return raw.upper()
        if not self._org_repo:
            # No org repo wired — only built-in tiers can be validated.
            raise ValidationError(f"Invalid role: {raw}")
        for r in self._org_repo.list_roles(org_id):
            if (r.get("role_id") or "").lower() != raw.lower():
                continue
            if r.get("scope", "system") != "system":
                raise ValidationError(
                    f"Role '{raw}' is not a system-scope role and cannot be assigned to a user."
                )
            return r.get("role_id") or raw.lower()
        raise ValidationError(f"Invalid role: {raw}")


class DeleteUserUseCase:
    """
    Caller authorization is permission-driven (`user.delete`):
      - OWNER (or any role granting `user.role.manage`) can delete
        anyone except OWNER and self.
      - Other privileged callers can only delete non-privileged users
        — prevents lateral deletion of fellow admins or custom
        admin-tier roles via this use case.
      - Members and unprivileged custom roles get rejected.

    Session 8 replaced the literal SystemRole enum check with a
    permission-driven gate so tenant-defined roles that grant
    `user.delete` actually work end-to-end.
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: IIdentityService, project_repo: IProjectRepository):
        self._user_repo = user_repo
        self._cognito = cognito_service
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> None:
        target_user_id = dto["user_id"]

        if target_user_id == caller_user_id:
            raise AuthorizationError("You cannot delete your own account.")

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        if (target_user.system_role or "").upper() == SystemRole.OWNER.value:
            raise AuthorizationError("The Owner account cannot be deleted.")

        if not role_has(caller_system_role, P.USER_DELETE):
            raise AuthorizationError("You don't have permission to delete user accounts.")

        # OWNER (and any role with USER_ROLE_MANAGE — i.e. role-admins)
        # can delete anyone. Other privileged callers (built-in ADMIN
        # or custom roles granting USER_DELETE but NOT USER_ROLE_MANAGE)
        # can only delete non-privileged users — prevents an ADMIN from
        # quietly removing another ADMIN.
        caller_is_role_admin = role_has(caller_system_role, P.USER_ROLE_MANAGE)
        if not caller_is_role_admin:
            target_is_privileged = role_has(target_user.system_role, P.USER_DELETE) or role_has(
                target_user.system_role, P.USER_ROLE_MANAGE
            )
            if target_is_privileged:
                raise AuthorizationError(
                    "You can only delete users with non-privileged roles."
                )

        # Delete from Cognito
        self._cognito.delete_user(target_user.email)

        # Remove from all project memberships
        projects = self._project_repo.find_projects_for_user(target_user_id)
        for project in projects:
            self._project_repo.remove_member(project.project_id, target_user_id)

        # Delete from DynamoDB
        self._user_repo.delete(target_user_id)
