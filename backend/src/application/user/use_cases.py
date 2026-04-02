from __future__ import annotations
import hashlib
import logging
import os
import secrets
import string
import uuid
from datetime import datetime, timezone

from domain.user.entities import User
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole, PRIVILEGED_ROLES
from domain.project.repository import IProjectRepository
from domain.task.repository import ITaskRepository
from shared.errors import AuthorizationError, NotFoundError, ValidationError
from domain.user.identity_service import IIdentityService


class ListUsersUseCase:
    """OWNER and ADMIN see all users."""
    def __init__(self, user_repo: IUserRepository):
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only owners and admins can list users")
        users = self._user_repo.find_all()
        return [u.to_dict() for u in users]


class UpdateUserRoleUseCase:
    """Only OWNER can promote/demote users between ADMIN and MEMBER."""
    def __init__(self, user_repo: IUserRepository, identity_service: IIdentityService):
        self._user_repo = user_repo
        self._cognito = identity_service

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role != SystemRole.OWNER.value:
            raise AuthorizationError("Only the owner can change user roles")

        target_user_id = dto["user_id"]
        new_role_value = dto["system_role"]

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        if target_user.system_role == SystemRole.OWNER:
            raise AuthorizationError("Cannot change the owner role")

        try:
            new_role = SystemRole(new_role_value)
        except ValueError:
            raise ValidationError(f"Invalid system role: {new_role_value}")

        if new_role == SystemRole.OWNER:
            raise AuthorizationError("Cannot promote to owner")

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
            raise AuthorizationError("Only owners and admins can view user progress")

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
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: IIdentityService):
        self._user_repo = user_repo
        self._cognito = cognito_service

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

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        target_role = dto.get("system_role", "MEMBER")
        email = dto["email"]
        name = dto["name"]

        # Validate the target role
        try:
            role_enum = SystemRole(target_role)
        except ValueError:
            raise ValidationError(f"Invalid role: {target_role}")

        # Cannot create an owner
        if role_enum == SystemRole.OWNER:
            raise AuthorizationError("Cannot create an owner account")

        # Authorization: who can create whom
        if caller_system_role in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            if role_enum not in (SystemRole.ADMIN, SystemRole.MEMBER):
                raise AuthorizationError("Can only create admin or member accounts")
        else:
            raise AuthorizationError("Members cannot create user accounts")

        # Check if email already exists
        existing = self._user_repo.find_by_email(email)
        if existing:
            raise ValidationError(f"User with email {email} already exists")

        # Get company prefix from OWNER
        all_users_for_prefix = self._user_repo.find_all()
        owner = next((u for u in all_users_for_prefix if u.system_role == SystemRole.OWNER), None)
        company_prefix = (owner.company_prefix if owner and owner.company_prefix else "NS").upper()

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
                raise ValidationError("Unable to generate a unique employee ID")

        # Generate one-time password
        otp = self._generate_otp()

        # Create in Cognito with OTP as temporary password
        # User will be in FORCE_CHANGE_PASSWORD state
        try:
            user_id = self._cognito.create_user(email, name, otp, target_role, employee_id)
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
            from infrastructure.email.gmail_service import GmailEmailService
            app_url = os.environ.get("APP_URL", "")

            # Get company name from OWNER account (reuse earlier query)
            company_name = owner.name if owner else "TaskFlow"

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
            raise AuthorizationError("Cannot delete your own account")

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        if target_user.system_role == SystemRole.OWNER:
            raise AuthorizationError("Cannot delete the owner account")

        if caller_system_role == SystemRole.OWNER.value:
            pass  # OWNER can delete anyone
        elif caller_system_role == SystemRole.ADMIN.value:
            if target_user.system_role != SystemRole.MEMBER:
                raise AuthorizationError("Admins can only delete member accounts")
        else:
            raise AuthorizationError("Members cannot delete user accounts")

        # Delete from Cognito
        self._cognito.delete_user(target_user.email)

        # Remove from all project memberships
        projects = self._project_repo.find_projects_for_user(target_user_id)
        for project in projects:
            self._project_repo.remove_member(project.project_id, target_user_id)

        # Delete from DynamoDB
        self._user_repo.delete(target_user_id)
