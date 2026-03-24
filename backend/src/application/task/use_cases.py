from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.board.repository import IBoardRepository
from domain.board.value_objects import BoardRole
from domain.task.entities import Task
from domain.task.repository import ITaskRepository
from domain.task.value_objects import TaskPriority, TaskStatus
from shared.errors import AuthorizationError, NotFoundError, ValidationError


class CreateTaskUseCase:
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, **kwargs) -> dict:
        board_id = dto["board_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role not in (
            BoardRole.ADMIN,
            BoardRole.MEMBER,
        ):
            raise AuthorizationError("You must be a board admin or member to create tasks")

        status = TaskStatus.TODO
        if dto.get("status"):
            try:
                status = TaskStatus(dto["status"])
            except ValueError:
                raise ValidationError(f"Invalid status: {dto['status']}")

        priority = TaskPriority.MEDIUM
        if dto.get("priority"):
            try:
                priority = TaskPriority(dto["priority"])
            except ValueError:
                raise ValidationError(f"Invalid priority: {dto['priority']}")

        task = Task.create(
            task_id=str(uuid.uuid4()),
            board_id=board_id,
            title=dto["title"],
            created_by=caller_user_id,
            description=dto.get("description"),
            status=status,
            priority=priority,
            assigned_to=dto.get("assigned_to"),
            due_date=dto.get("due_date"),
        )
        self._task_repo.save(task)
        return task.to_dict()


class GetTaskUseCase:
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, **kwargs) -> dict:
        board_id = dto["board_id"]
        task_id = dto["task_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member:
            raise AuthorizationError("You are not a member of this board")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        return task.to_dict()


class ListTasksForBoardUseCase:
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, **kwargs) -> list[dict]:
        board_id = dto["board_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member:
            raise AuthorizationError("You are not a member of this board")

        tasks = self._task_repo.find_by_board(board_id)
        return [t.to_dict() for t in tasks]


class UpdateTaskUseCase:
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, **kwargs) -> dict:
        board_id = dto["board_id"]
        task_id = dto["task_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role not in (
            BoardRole.ADMIN,
            BoardRole.MEMBER,
        ):
            raise AuthorizationError("You must be a board admin or member to update tasks")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        # Apply updates
        title = dto.get("title", task.title)
        description = dto.get("description", task.description)
        due_date = dto.get("due_date", task.due_date)
        assigned_to = dto.get("assigned_to", task.assigned_to)

        status = task.status
        if dto.get("status"):
            try:
                status = TaskStatus(dto["status"])
            except ValueError:
                raise ValidationError(f"Invalid status: {dto['status']}")

        priority = task.priority
        if dto.get("priority"):
            try:
                priority = TaskPriority(dto["priority"])
            except ValueError:
                raise ValidationError(f"Invalid priority: {dto['priority']}")

        now = datetime.now(timezone.utc).isoformat()
        updated_task = Task(
            task_id=task.task_id,
            board_id=task.board_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            assigned_to=assigned_to,
            created_by=task.created_by,
            due_date=due_date,
            created_at=task.created_at,
            updated_at=now,
        )
        self._task_repo.update(updated_task)
        return updated_task.to_dict()


class DeleteTaskUseCase:
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, **kwargs) -> None:
        board_id = dto["board_id"]
        task_id = dto["task_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role != BoardRole.ADMIN:
            raise AuthorizationError("Only board admins can delete tasks")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        self._task_repo.delete(task_id, board_id)


class AssignTaskUseCase:
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, **kwargs) -> dict:
        board_id = dto["board_id"]
        task_id = dto["task_id"]
        assignee_id = dto["assigned_to"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role not in (
            BoardRole.ADMIN,
            BoardRole.MEMBER,
        ):
            raise AuthorizationError("You must be a board admin or member to assign tasks")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        assignee_member = self._board_repo.find_member(board_id, assignee_id)
        if not assignee_member:
            raise NotFoundError(f"User {assignee_id} is not a member of board {board_id}")

        now = datetime.now(timezone.utc).isoformat()
        updated_task = Task(
            task_id=task.task_id,
            board_id=task.board_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            assigned_to=assignee_id,
            created_by=task.created_by,
            due_date=task.due_date,
            created_at=task.created_at,
            updated_at=now,
        )
        self._task_repo.update(updated_task)
        return updated_task.to_dict()
