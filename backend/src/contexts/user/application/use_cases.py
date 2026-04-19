from __future__ import annotations
import hashlib
import logging
import os
import secrets
import string
import uuid
from datetime import datetime, timezone

from contexts.user.domain.entities import User
from contexts.user.domain.repository import IUserRepository
from contexts.user.domain.value_objects import SystemRole, PRIVILEGED_ROLES
from contexts.project.domain.repository import IProjectRepository
from contexts.task.domain.repository import ITaskRepository
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from contexts.user.domain.identity_service import IIdentityService


class ListUsersUseCase:
    """OWNER and ADMIN see all users."""
    def __init__(self, user_repo: IUserRepository):
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("You don't have permission to view the user list.")
        users = self._user_repo.find_all()
        return [u.to_dict() for u in users]


class UpdateUserRoleUseCase:
    """Only OWNER can promote/demote users between ADMIN and MEMBER."""
    def __init__(self, user_repo: IUserRepository, identity_service: IIdentityService):
        self._user_repo = user_repo
        self._cognito = identity_service

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role != SystemRole.OWNER.value:
            raise AuthorizationError("Only the Owner can change user roles.")

        target_user_id = dto["user_id"]
        new_role_value = dto["system_role"]

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        if target_user.system_role == SystemRole.OWNER:
            raise AuthorizationError("The Owner role cannot be changed.")

        try:
            new_role = SystemRole(new_role_value)
        except ValueError:
            raise ValidationError(f"Invalid system role: {new_role_value}")

        if new_role == SystemRole.OWNER:
            raise AuthorizationError("Users cannot be promoted to the Owner role.")

        if new_role not in (SystemRole.ADMIN, SystemRole.MEMBER):
            raise ValidationError(f"Invalid target role: {new_role_value}")

        updated_user = target_user.model_copy(update={
            "system_role": new_role,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        self._user_repo.update(updated_user)
        self._cognito.update_user_role(target_user.email, new_role.value)

        return updated_user.to_dict()


class GetUserProgressUseCase:
    """OWNER and ADMIN can view anyone's progress."""
    def __init__(self, user_repo: IUserRepository, project_repo: IProjectRepository, task_repo: ITaskRepository):
        self._user_repo = user_repo
        self._project_repo = project_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role not in PRIVILEGED_ROLES:
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
    Owner creates Admins or Members.
    Admins create Admins or Members.
    Members cannot create anyone.
    Nobody can create OWNER.

    Multi-tenant: every created user is scoped to the caller's org_id.
    The Cognito user gets `custom:orgId` set so they land in the right
    tenant on first login, and the User profile record is written via
    `user_repo` which is already org-scoped via the AuthContext ContextVar.
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: IIdentityService, org_repo=None):
        self._user_repo = user_repo
        self._cognito = cognito_service
        self._org_repo = org_repo  # optional — used to read OrgSettings for branding

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
        target_role = dto.get("system_role", "MEMBER")
        email = dto["email"]
        name = dto["name"]

        if not caller_org_id:
            raise ValidationError("Org context is missing.")

        # Validate the target role
        try:
            role_enum = SystemRole(target_role)
        except ValueError:
            raise ValidationError(f"Invalid role: {target_role}")

        # Cannot create an owner
        if role_enum == SystemRole.OWNER:
            raise AuthorizationError("An Owner account cannot be created.")

        # Authorization: who can create whom
        if caller_system_role in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            if role_enum not in (SystemRole.ADMIN, SystemRole.MEMBER):
                raise AuthorizationError("You can only create Admin or Member accounts.")
        else:
            raise AuthorizationError("You don't have permission to create user accounts.")

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

        # Create in DynamoDB
        user = User.create(
            user_id=user_id,
            email=email,
            name=name,
            system_role=role_enum,
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


class DeleteUserUseCase:
    """
    OWNER can delete anyone except self.
    ADMIN can delete MEMBER only.
    Cannot delete Owner.
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

        if target_user.system_role == SystemRole.OWNER:
            raise AuthorizationError("The Owner account cannot be deleted.")

        if caller_system_role == SystemRole.OWNER.value:
            pass  # OWNER can delete anyone
        elif caller_system_role == SystemRole.ADMIN.value:
            if target_user.system_role != SystemRole.MEMBER:
                raise AuthorizationError("You can only delete Member accounts.")
        else:
            raise AuthorizationError("You don't have permission to delete user accounts.")

        # Delete from Cognito
        self._cognito.delete_user(target_user.email)

        # Remove from all project memberships
        projects = self._project_repo.find_projects_for_user(target_user_id)
        for project in projects:
            self._project_repo.remove_member(project.project_id, target_user_id)

        # Delete from DynamoDB
        self._user_repo.delete(target_user_id)
