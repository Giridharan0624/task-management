from __future__ import annotations
import uuid
from datetime import datetime, timezone

from domain.user.entities import User
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from domain.board.repository import IBoardRepository
from domain.task.repository import ITaskRepository
from shared.errors import AuthorizationError, NotFoundError, ValidationError


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
    def __init__(self, user_repo: IUserRepository):
        self._user_repo = user_repo

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
