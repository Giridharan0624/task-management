from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.board.repository import IBoardRepository
from domain.board.value_objects import BoardRole
from domain.task.entities import Task
from domain.task.repository import ITaskRepository
from domain.task.value_objects import TaskPriority, TaskStatus
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError, ValidationError


class CreateTaskUseCase:
    """Owner can create tasks on any board. Admin can create tasks on boards they belong to.
    Members cannot create tasks (they receive tasks)."""
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        board_id = dto["board_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        # Owner can create tasks on any board
        if caller_system_role == SystemRole.OWNER.value:
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can create tasks on boards they are a member of
            caller_member = self._board_repo.find_member(board_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You must be a board member to create tasks on this board")
        else:
            # Members cannot create tasks
            raise AuthorizationError("Members cannot create tasks")

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
    """Any board member can view a task."""
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        board_id = dto["board_id"]
        task_id = dto["task_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        # Owner can view any task; others must be board members
        if caller_system_role != SystemRole.OWNER.value:
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

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> list[dict]:
        board_id = dto["board_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        # Owner can list any board's tasks; others must be board members
        if caller_system_role != SystemRole.OWNER.value:
            caller_member = self._board_repo.find_member(board_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You are not a member of this board")

        tasks = self._task_repo.find_by_board(board_id)
        return [t.to_dict() for t in tasks]


class UpdateTaskUseCase:
    """Owner and Admin can update any task field.
    Members can ONLY update the status field of tasks assigned to them."""
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        board_id = dto["board_id"]
        task_id = dto["task_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        # Member can only update status of tasks assigned to them
        if caller_system_role == SystemRole.MEMBER.value:
            if task.assigned_to != caller_user_id:
                raise AuthorizationError("You can only update tasks assigned to you")
            # Members can only update the status field
            allowed_fields = {"board_id", "task_id", "status"}
            extra_fields = set(dto.keys()) - allowed_fields
            if extra_fields:
                raise AuthorizationError("Members can only update the status of their assigned tasks")
        elif caller_system_role == SystemRole.OWNER.value:
            # Owner can update any task
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can update any task on boards they belong to
            caller_member = self._board_repo.find_member(board_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You must be a board member to update tasks on this board")
        else:
            raise AuthorizationError("Unauthorized to update tasks")

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
    """Owner can delete any task. Admin can delete tasks they created."""
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> None:
        board_id = dto["board_id"]
        task_id = dto["task_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        if caller_system_role == SystemRole.OWNER.value:
            # Owner can delete any task
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can delete tasks they created
            if task.created_by != caller_user_id:
                raise AuthorizationError("Admins can only delete tasks they created")
        else:
            raise AuthorizationError("Members cannot delete tasks")

        self._task_repo.delete(task_id, board_id)


class AssignTaskUseCase:
    """Owner can assign to anyone. Admin can assign to members only."""
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        board_id = dto["board_id"]
        task_id = dto["task_id"]
        assignee_id = dto["assigned_to"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.board_id != board_id:
            raise NotFoundError(f"Task {task_id} not found")

        # Authorization: who can assign
        if caller_system_role == SystemRole.OWNER.value:
            # Owner can assign to anyone on the board
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can assign to members only
            assignee_member = self._board_repo.find_member(board_id, assignee_id)
            if not assignee_member:
                raise NotFoundError(f"User {assignee_id} is not a member of board {board_id}")
            if assignee_member.board_role != BoardRole.MEMBER:
                raise AuthorizationError("Admins can only assign tasks to members")
        else:
            raise AuthorizationError("Members cannot assign tasks")

        # Verify assignee is on the board (for owner case too)
        if caller_system_role == SystemRole.OWNER.value:
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


class GetMyAssignedTasksUseCase:
    """Get all tasks assigned to the caller across all boards."""
    def __init__(self, task_repo: ITaskRepository, board_repo: IBoardRepository):
        self._task_repo = task_repo
        self._board_repo = board_repo

    def execute(self, caller_user_id: str) -> list[dict]:
        boards = self._board_repo.find_boards_for_user(caller_user_id)
        my_tasks = []
        for board in boards:
            tasks = self._task_repo.find_by_board(board.board_id)
            for task in tasks:
                if task.assigned_to == caller_user_id:
                    task_dict = task.to_dict()
                    task_dict["board_name"] = board.name
                    my_tasks.append(task_dict)
        return my_tasks
