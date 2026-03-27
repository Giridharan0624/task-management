from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.comment.repository import ICommentRepository
from domain.project.repository import IProjectRepository
from domain.project.value_objects import ProjectRole
from domain.task.entities import Task
from domain.task.repository import ITaskRepository
from domain.task.value_objects import TaskPriority, TaskStatus
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError, ValidationError


class CreateTaskUseCase:
    """Owner can create tasks on any project. Admin can create tasks on projects they belong to.
    Members cannot create tasks (they receive tasks)."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        project_id = dto["project_id"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        # Owner can create tasks on any project
        if caller_system_role == SystemRole.OWNER.value:
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can create tasks on projects they are a member of
            caller_member = self._project_repo.find_member(project_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You must be a project member to create tasks on this project")
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

        assigned_to = dto.get("assigned_to", [])
        # Validate all assignees are project members
        for assignee_id in assigned_to:
            assignee_member = self._project_repo.find_member(project_id, assignee_id)
            if not assignee_member:
                raise NotFoundError(f"User {assignee_id} is not a member of project {project_id}")

        deadline = dto["deadline"]

        task = Task.create(
            task_id=str(uuid.uuid4()),
            project_id=project_id,
            title=dto["title"],
            created_by=caller_user_id,
            description=dto.get("description"),
            status=status,
            priority=priority,
            assigned_to=assigned_to,
            assigned_by=caller_user_id if assigned_to else None,
            deadline=deadline,
        )
        self._task_repo.save(task)
        return task.to_dict()


class GetTaskUseCase:
    """Any project member can view a task."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        project_id = dto["project_id"]
        task_id = dto["task_id"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        # Owner can view any task; others must be project members
        if caller_system_role != SystemRole.OWNER.value:
            caller_member = self._project_repo.find_member(project_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You are not a member of this project")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.project_id != project_id:
            raise NotFoundError(f"Task {task_id} not found")

        return task.to_dict()


class ListTasksForProjectUseCase:
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> list[dict]:
        project_id = dto["project_id"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        # Owner can list any project's tasks; others must be project members
        if caller_system_role != SystemRole.OWNER.value:
            caller_member = self._project_repo.find_member(project_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You are not a member of this project")

        tasks = self._task_repo.find_by_project(project_id)
        return [t.to_dict() for t in tasks]


class UpdateTaskUseCase:
    """Owner and Admin can update any task field.
    Members can ONLY update the status field of tasks assigned to them."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        project_id = dto["project_id"]
        task_id = dto["task_id"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.project_id != project_id:
            raise NotFoundError(f"Task {task_id} not found")

        # Member can only update status of tasks assigned to them
        if caller_system_role == SystemRole.MEMBER.value:
            if caller_user_id not in task.assigned_to:
                raise AuthorizationError("You can only update tasks assigned to you")
            # Members can only update the status field
            allowed_fields = {"project_id", "task_id", "status"}
            extra_fields = set(dto.keys()) - allowed_fields
            if extra_fields:
                raise AuthorizationError("Members can only update the status of their assigned tasks")
        elif caller_system_role == SystemRole.OWNER.value:
            # Owner can update any task
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can update any task on projects they belong to
            caller_member = self._project_repo.find_member(project_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You must be a project member to update tasks on this project")
        else:
            raise AuthorizationError("Unauthorized to update tasks")

        # Apply updates
        title = dto.get("title", task.title)
        description = dto.get("description", task.description)
        deadline = dto.get("deadline", task.deadline)
        assigned_to = dto.get("assigned_to", task.assigned_to)
        assigned_by = task.assigned_by
        if "assigned_to" in dto and dto["assigned_to"] != task.assigned_to:
            # Validate all new assignees are project members
            for assignee_id in assigned_to:
                assignee_member = self._project_repo.find_member(project_id, assignee_id)
                if not assignee_member:
                    raise NotFoundError(f"User {assignee_id} is not a member of project {project_id}")
            assigned_by = caller_user_id

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
            project_id=task.project_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            created_by=task.created_by,
            deadline=deadline,
            created_at=task.created_at,
            updated_at=now,
        )
        self._task_repo.update(updated_task)
        return updated_task.to_dict()


class DeleteTaskUseCase:
    """Owner can delete any task. Admin can delete tasks they created."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository, comment_repo: ICommentRepository = None):
        self._task_repo = task_repo
        self._project_repo = project_repo
        self._comment_repo = comment_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> None:
        project_id = dto["project_id"]
        task_id = dto["task_id"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.project_id != project_id:
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

        # Cascade delete comments
        if self._comment_repo:
            self._comment_repo.delete_all_by_task(task_id)
        self._task_repo.delete(task_id, project_id)


class AssignTaskUseCase:
    """Owner can assign to anyone. Admin can assign to members only."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        project_id = dto["project_id"]
        task_id = dto["task_id"]
        assignee_ids = dto["assigned_to"]  # list of user IDs

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.project_id != project_id:
            raise NotFoundError(f"Task {task_id} not found")

        # Authorization: who can assign
        if caller_system_role == SystemRole.OWNER.value:
            # Owner can assign to anyone on the project
            pass
        elif caller_system_role == SystemRole.ADMIN.value:
            # Admin can assign to members only
            pass
        else:
            raise AuthorizationError("Members cannot assign tasks")

        # Validate each assignee is a project member
        for assignee_id in assignee_ids:
            assignee_member = self._project_repo.find_member(project_id, assignee_id)
            if not assignee_member:
                raise NotFoundError(f"User {assignee_id} is not a member of project {project_id}")
            if caller_system_role == SystemRole.ADMIN.value:
                if assignee_member.project_role != ProjectRole.MEMBER:
                    raise AuthorizationError("Admins can only assign tasks to members")

        now = datetime.now(timezone.utc).isoformat()
        updated_task = Task(
            task_id=task.task_id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            assigned_to=assignee_ids,
            assigned_by=caller_user_id,
            created_by=task.created_by,
            deadline=task.deadline,
            created_at=task.created_at,
            updated_at=now,
        )
        self._task_repo.update(updated_task)
        return updated_task.to_dict()


class GetMyAssignedTasksUseCase:
    """Get all tasks assigned to the caller across all projects."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, caller_user_id: str) -> list[dict]:
        projects = self._project_repo.find_projects_for_user(caller_user_id)
        my_tasks = []
        for project in projects:
            tasks = self._task_repo.find_by_project(project.project_id)
            for task in tasks:
                if caller_user_id in task.assigned_to:
                    task_dict = task.to_dict()
                    task_dict["project_name"] = project.name
                    my_tasks.append(task_dict)
        return my_tasks
