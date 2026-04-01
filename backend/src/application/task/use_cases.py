from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.comment.repository import ICommentRepository
from domain.project.repository import IProjectRepository
from domain.project.value_objects import ProjectRole
from domain.task.entities import Task
from domain.task.repository import ITaskRepository
from domain.task.value_objects import TaskPriority, DOMAIN_STATUSES, DOMAIN_PROGRESS
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole, PRIVILEGED_ROLES
from shared.errors import AuthorizationError, NotFoundError, ValidationError
_TASK_MANAGE_ROLES = (ProjectRole.ADMIN, ProjectRole.PROJECT_MANAGER, ProjectRole.TEAM_LEAD)


def _can_manage_tasks(project_repo, project_id, caller_user_id, caller_system_role):
    """OWNER/ADMIN system role OR project ADMIN/TEAM_LEAD can manage tasks."""
    if caller_system_role in PRIVILEGED_ROLES:
        return True
    member = project_repo.find_member(project_id, caller_user_id)
    return member is not None and member.project_role in _TASK_MANAGE_ROLES


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

        # Owner/Admin/Team Lead can create tasks; Members cannot
        if not _can_manage_tasks(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only owners, admins, and team leads can create tasks")

        # Domain comes from the project
        domain = project.domain or "DEVELOPMENT"
        valid_statuses = DOMAIN_STATUSES.get(domain, DOMAIN_STATUSES["DEVELOPMENT"])

        status = "TODO"
        if dto.get("status"):
            if dto["status"] not in valid_statuses:
                raise ValidationError(f"Invalid status '{dto['status']}' for domain {domain}")
            status = dto["status"]

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
            domain=domain,
            assigned_to=assigned_to,
            assigned_by=caller_user_id if assigned_to else None,
            deadline=deadline,
            estimated_hours=dto.get("estimated_hours"),
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

        # Owner/Admin can view any task; others must be project members
        if caller_system_role not in PRIVILEGED_ROLES:
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

        # Owner/Admin can list any project's tasks; others must be project members
        caller_member = None
        if caller_system_role not in PRIVILEGED_ROLES:
            caller_member = self._project_repo.find_member(project_id, caller_user_id)
            if not caller_member:
                raise AuthorizationError("You are not a member of this project")

        tasks = self._task_repo.find_by_project(project_id)

        # Members only see tasks assigned to them; Team Leads and above see all
        if caller_system_role in PRIVILEGED_ROLES:
            return [t.to_dict() for t in tasks]

        if not caller_member:
            caller_member = self._project_repo.find_member(project_id, caller_user_id)

        if caller_member and caller_member.project_role in _TASK_MANAGE_ROLES:
            return [t.to_dict() for t in tasks]

        # Regular MEMBER — only assigned tasks
        return [t.to_dict() for t in tasks if caller_user_id in t.assigned_to]


class UpdateTaskUseCase:
    """Owner and Admin can update any task field.
    Members can ONLY update the status field of tasks assigned to them."""
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str = None) -> dict:
        project_id = dto["project_id"]
        task_id = dto["task_id"]

        if project_id != "DIRECT":
            project = self._project_repo.find_by_id(project_id)
            if not project:
                raise NotFoundError(f"Project {project_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.project_id != project_id:
            raise NotFoundError(f"Task {task_id} not found")

        # Owner/Admin/Team Lead can update any task; Member can only update status of their assigned tasks
        if project_id == "DIRECT" and caller_system_role in PRIVILEGED_ROLES:
            pass
        elif project_id != "DIRECT" and _can_manage_tasks(self._project_repo, project_id, caller_user_id, caller_system_role):
            pass
        elif caller_system_role == SystemRole.MEMBER.value:
            if caller_user_id not in task.assigned_to:
                raise AuthorizationError("You can only update tasks assigned to you")
            allowed_fields = {"project_id", "task_id", "status"}
            extra_fields = set(dto.keys()) - allowed_fields
            if extra_fields:
                raise AuthorizationError("Members can only update the status of their assigned tasks")
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

        # Domain can be updated
        task_domain = dto.get("domain", task.domain) or "DEVELOPMENT"
        valid_statuses = DOMAIN_STATUSES.get(task_domain, DOMAIN_STATUSES["DEVELOPMENT"])

        status = task.status
        if dto.get("status"):
            if dto["status"] not in valid_statuses:
                raise ValidationError(f"Invalid status '{dto['status']}' for domain {task_domain}")
            status = dto["status"]

        priority = task.priority
        if dto.get("priority"):
            try:
                priority = TaskPriority(dto["priority"])
            except ValueError:
                raise ValidationError(f"Invalid priority: {dto['priority']}")

        estimated_hours = dto.get("estimated_hours", task.estimated_hours)

        now = datetime.now(timezone.utc).isoformat()
        updated_task = Task(
            task_id=task.task_id,
            project_id=task.project_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            domain=task_domain,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            created_by=task.created_by,
            deadline=deadline,
            estimated_hours=estimated_hours,
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

        if project_id != "DIRECT":
            project = self._project_repo.find_by_id(project_id)
            if not project:
                raise NotFoundError(f"Project {project_id} not found")

        task = self._task_repo.find_by_id(task_id)
        if not task or task.project_id != project_id:
            raise NotFoundError(f"Task {task_id} not found")

        if project_id == "DIRECT":
            if caller_system_role not in PRIVILEGED_ROLES:
                raise AuthorizationError("Only privileged users can delete direct tasks")
        elif not _can_manage_tasks(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only owners, admins, and team leads can delete tasks")

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

        # Authorization: Owner/Admin/Team Lead can assign
        if not _can_manage_tasks(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only owners, admins, and team leads can assign tasks")

        # Validate each assignee is a project member
        for assignee_id in assignee_ids:
            assignee_member = self._project_repo.find_member(project_id, assignee_id)
            if not assignee_member:
                raise NotFoundError(f"User {assignee_id} is not a member of project {project_id}")

        now = datetime.now(timezone.utc).isoformat()
        updated_task = Task(
            task_id=task.task_id,
            project_id=task.project_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            domain=task.domain,
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
    def __init__(self, task_repo: ITaskRepository, project_repo: IProjectRepository, user_repo: IUserRepository | None = None):
        self._task_repo = task_repo
        self._project_repo = project_repo
        self._user_repo = user_repo

    def _build_name_map(self, user_ids: set[str]) -> dict[str, str]:
        """Resolve user IDs to names."""
        if not self._user_repo or not user_ids:
            return {}
        name_map: dict[str, str] = {}
        for uid in user_ids:
            user = self._user_repo.find_by_id(uid)
            if user:
                name_map[uid] = user.name or user.email
        return name_map

    def execute(self, caller_user_id: str, caller_system_role: str = None) -> list[dict]:
        my_tasks = []

        # Include direct tasks (no project)
        direct_tasks = self._task_repo.find_by_project("DIRECT")
        if caller_system_role in PRIVILEGED_ROLES:
            for task in direct_tasks:
                task_dict = task.to_dict()
                task_dict["project_name"] = "Direct Task"
                my_tasks.append(task_dict)
        else:
            for task in direct_tasks:
                if caller_user_id in task.assigned_to:
                    task_dict = task.to_dict()
                    task_dict["project_name"] = "Direct Task"
                    my_tasks.append(task_dict)

        # Project tasks
        if caller_system_role in PRIVILEGED_ROLES:
            projects = self._project_repo.find_all()
            for project in projects:
                tasks = self._task_repo.find_by_project(project.project_id)
                for task in tasks:
                    task_dict = task.to_dict()
                    task_dict["project_name"] = project.name
                    my_tasks.append(task_dict)
        else:
            projects = self._project_repo.find_projects_for_user(caller_user_id)
            for project in projects:
                tasks = self._task_repo.find_by_project(project.project_id)
                for task in tasks:
                    if caller_user_id in task.assigned_to:
                        task_dict = task.to_dict()
                        task_dict["project_name"] = project.name
                        my_tasks.append(task_dict)

        # Resolve assigned_by and created_by user IDs to names
        user_ids_to_resolve: set[str] = set()
        for t in my_tasks:
            if t.get("assigned_by"):
                user_ids_to_resolve.add(t["assigned_by"])
            if t.get("created_by"):
                user_ids_to_resolve.add(t["created_by"])
        name_map = self._build_name_map(user_ids_to_resolve)
        for t in my_tasks:
            if t.get("assigned_by") and t["assigned_by"] in name_map:
                t["assigned_by_name"] = name_map[t["assigned_by"]]
            if t.get("created_by") and t["created_by"] in name_map:
                t["created_by_name"] = name_map[t["created_by"]]

        return my_tasks
