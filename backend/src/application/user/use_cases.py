from __future__ import annotations
import uuid
from datetime import datetime, timezone

from domain.user.entities import User
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from domain.board.repository import IBoardRepository
from domain.task.repository import ITaskRepository
from shared.errors import AuthorizationError, NotFoundError, ValidationError
from infrastructure.cognito.cognito_service import CognitoService


class ListUsersUseCase:
    """OWNER and ADMIN can list all users."""
    def __init__(self, user_repo: IUserRepository):
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can list users")
        users = self._user_repo.find_all()
        return [u.to_dict() for u in users]


class UpdateUserRoleUseCase:
    """OWNER can promote/demote users to ADMIN. OWNER cannot be changed."""
    def __init__(self, user_repo: IUserRepository, cognito_service: CognitoService = None):
        self._user_repo = user_repo
        self._cognito = cognito_service or CognitoService()

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
    """OWNER and ADMIN can view a specific user's task progress across all boards."""
    def __init__(self, user_repo: IUserRepository, board_repo: IBoardRepository, task_repo: ITaskRepository):
        self._user_repo = user_repo
        self._board_repo = board_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can view user progress")

        target_user_id = dto["user_id"]
        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        # Get all boards the target user belongs to
        boards = self._board_repo.find_boards_for_user(target_user_id)

        board_progress = []
        total_stats = {"TODO": 0, "IN_PROGRESS": 0, "DONE": 0, "total": 0}

        for board in boards:
            tasks = self._task_repo.find_by_board(board.board_id)
            # Filter tasks assigned to this user
            user_tasks = [t for t in tasks if t.assigned_to == target_user_id]

            stats = {"TODO": 0, "IN_PROGRESS": 0, "DONE": 0}
            for task in user_tasks:
                stats[task.status.value] = stats.get(task.status.value, 0) + 1

            board_progress.append({
                "board_id": board.board_id,
                "board_name": board.name,
                "tasks": [t.to_dict() for t in user_tasks],
                "stats": stats,
            })

            for key in ("TODO", "IN_PROGRESS", "DONE"):
                total_stats[key] += stats[key]
            total_stats["total"] += len(user_tasks)

        return {
            "user": target_user.to_dict(),
            "boards": board_progress,
            "total_stats": total_stats,
        }


class CreateUserUseCase:
    """
    Owner creates Admins.
    Admins create Members/Viewers.
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: CognitoService):
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

        # Authorization: who can create whom
        if role_enum == SystemRole.OWNER:
            raise AuthorizationError("Cannot create an owner account")

        if role_enum == SystemRole.ADMIN:
            if caller_system_role != SystemRole.OWNER.value:
                raise AuthorizationError("Only the owner can create admin accounts")
        else:
            # MEMBER or VIEWER
            if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
                raise AuthorizationError("Only owners and admins can create user accounts")

        # Check if email already exists
        existing = self._user_repo.find_by_email(email)
        if existing:
            raise ValidationError(f"User with email {email} already exists")

        # Create in Cognito
        user_id = self._cognito.create_user(email, name, password, target_role)
        self._cognito.set_permanent_password(email, password)

        # Create in DynamoDB
        now = datetime.now(timezone.utc).isoformat()
        user = User.create(
            user_id=user_id,
            email=email,
            name=name,
            system_role=role_enum,
        )
        self._user_repo.save(user)

        return user.to_dict()


class DeleteUserUseCase:
    """
    Owner deletes Admins.
    Admins delete Members/Viewers.
    Cannot delete Owner. Cannot delete self.
    """
    def __init__(self, user_repo: IUserRepository, cognito_service: CognitoService, board_repo: IBoardRepository):
        self._user_repo = user_repo
        self._cognito = cognito_service
        self._board_repo = board_repo

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
        if target_user.system_role == SystemRole.ADMIN:
            if caller_system_role != SystemRole.OWNER.value:
                raise AuthorizationError("Only the owner can delete admin accounts")
        else:
            if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
                raise AuthorizationError("Only owners and admins can delete users")

        # Delete from Cognito
        self._cognito.delete_user(target_user.email)

        # Remove from all board memberships
        boards = self._board_repo.find_boards_for_user(target_user_id)
        for board in boards:
            self._board_repo.remove_member(board.board_id, target_user_id)

        # Delete from DynamoDB
        self._user_repo.delete(target_user_id)
