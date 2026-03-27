from __future__ import annotations
import uuid
from datetime import datetime, timezone

from domain.user.entities import User
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from domain.project.repository import IProjectRepository
from domain.task.repository import ITaskRepository
from shared.errors import AuthorizationError, NotFoundError, ValidationError
from domain.user.identity_service import IIdentityService


class ListUsersUseCase:
    """OWNER sees all users. ADMIN sees only MEMBER users."""
    def __init__(self, user_repo: IUserRepository):
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can list users")
        users = self._user_repo.find_all()
        if caller_system_role == SystemRole.ADMIN.value:
            # Admins only see members
            users = [u for u in users if u.system_role == SystemRole.MEMBER]
        return [u.to_dict() for u in users]


class UpdateUserRoleUseCase:
    """OWNER can promote/demote users to ADMIN or MEMBER. OWNER cannot be changed."""
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
            raise AuthorizationError("Cannot change the owner's role")

        try:
            new_role = SystemRole(new_role_value)
        except ValueError:
            raise ValidationError(f"Invalid system role: {new_role_value}")

        if new_role == SystemRole.OWNER:
            raise AuthorizationError("Cannot promote to owner")

        # Valid target roles are only ADMIN and MEMBER
        if new_role not in (SystemRole.ADMIN, SystemRole.MEMBER):
            raise ValidationError(f"Invalid target role: {new_role_value}")

        updated_user = User(
            user_id=target_user.user_id,
            email=target_user.email,
            name=target_user.name,
            system_role=new_role,
            created_at=target_user.created_at,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        self._user_repo.update(updated_user)

        # Sync role to Cognito
        self._cognito.update_user_role(target_user.email, new_role.value)

        return updated_user.to_dict()


class GetUserProgressUseCase:
    """OWNER can view anyone's progress. ADMIN can only view MEMBER progress."""
    def __init__(self, user_repo: IUserRepository, project_repo: IProjectRepository, task_repo: ITaskRepository):
        self._user_repo = user_repo
        self._project_repo = project_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can view user progress")

        target_user_id = dto["user_id"]
        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        # Admin can only view member progress
        if caller_system_role == SystemRole.ADMIN.value:
            if target_user.system_role != SystemRole.MEMBER:
                raise AuthorizationError("Admins can only view member progress")

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
                stats[task.status.value] = stats.get(task.status.value, 0) + 1

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
    Admins create Members only.
    Members cannot create anyone.
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: IIdentityService):
        self._user_repo = user_repo
        self._cognito = cognito_service

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        target_role = dto.get("system_role", "MEMBER")
        email = dto["email"]
        name = dto["name"]
        password = dto["password"]

        # Validate the target role
        try:
            role_enum = SystemRole(target_role)
        except ValueError:
            raise ValidationError(f"Invalid role: {target_role}")

        # Cannot create an owner
        if role_enum == SystemRole.OWNER:
            raise AuthorizationError("Cannot create an owner account")

        # Authorization: who can create whom
        if caller_system_role == SystemRole.OWNER.value:
            # Owner can create ADMIN or MEMBER
            if role_enum not in (SystemRole.ADMIN, SystemRole.MEMBER):
                raise AuthorizationError("Owner can only create admin or member accounts")
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can only create MEMBER
            if role_enum != SystemRole.MEMBER:
                raise AuthorizationError("Admins can only create member accounts")
        else:
            # Members cannot create anyone
            raise AuthorizationError("Members cannot create user accounts")

        # Check if email already exists
        existing = self._user_repo.find_by_email(email)
        if existing:
            raise ValidationError(f"User with email {email} already exists")

        # Create in Cognito
        try:
            user_id = self._cognito.create_user(email, name, password, target_role)
            self._cognito.set_permanent_password(email, password)
        except Exception as e:
            msg = str(e)
            if "Password" in msg or "password" in msg:
                raise ValidationError(
                    "Password must be at least 8 characters with uppercase, lowercase, and numbers"
                )
            raise

        # Create in DynamoDB
        user = User.create(
            user_id=user_id,
            email=email,
            name=name,
            system_role=role_enum,
            created_by=caller_user_id,
        )
        # Set department at creation time
        if dto.get("department"):
            user = User(
                **{**user.model_dump(), "department": dto["department"]}
            )
        self._user_repo.save(user)

        return user.to_dict()


class DeleteUserUseCase:
    """
    Owner deletes Admins or Members.
    Admins delete Members only.
    Cannot delete Owner. Cannot delete self.
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

        # Authorization: who can delete whom
        if caller_system_role == SystemRole.OWNER.value:
            # Owner can delete ADMIN or MEMBER
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can only delete MEMBER
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
