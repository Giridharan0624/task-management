from __future__ import annotations

import uuid

from contexts.comment.domain.entities import ProgressComment
from contexts.comment.domain.repository import ICommentRepository
from contexts.org.domain import permissions as P
from contexts.project.domain.repository import IProjectRepository
from contexts.task.domain.repository import ITaskRepository
from contexts.user.domain.value_objects import SystemRole
from shared_kernel.errors import AuthorizationError, NotFoundError
from shared_kernel.permissions import role_has


class CreateCommentUseCase:
    def __init__(self, comment_repo: ICommentRepository, task_repo: ITaskRepository):
        self._comment_repo = comment_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        task_id = dto["task_id"]

        task = self._task_repo.find_by_id(task_id)
        if not task:
            raise NotFoundError(f"Task {task_id} not found")

        # Caller must be assigned to the task OR hold TASK_VIEW_ALL (the
        # "see any task" privilege — OWNER/ADMIN by default).
        if not role_has(caller_system_role, P.TASK_VIEW_ALL):
            if caller_user_id not in task.assigned_to:
                raise AuthorizationError("You must be assigned to this task to post a comment.")

        comment = ProgressComment.create(
            comment_id=str(uuid.uuid4()),
            task_id=task_id,
            project_id=task.project_id,
            author_id=caller_user_id,
            message=dto["message"],
        )
        self._comment_repo.save(comment)
        return comment.to_dict()


class ListCommentsUseCase:
    def __init__(self, comment_repo: ICommentRepository, task_repo: ITaskRepository, project_repo: IProjectRepository):
        self._comment_repo = comment_repo
        self._task_repo = task_repo
        self._project_repo = project_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> list[dict]:
        task_id = dto["task_id"]

        task = self._task_repo.find_by_id(task_id)
        if not task:
            raise NotFoundError(f"Task {task_id} not found")

        # TASK_VIEW_ALL holders bypass membership. Others must be a project member.
        if not role_has(caller_system_role, P.TASK_VIEW_ALL):
            member = self._project_repo.find_member(task.project_id, caller_user_id)
            if not member:
                raise AuthorizationError("You must be a member of this project to view comments.")

        comments = self._comment_repo.find_by_task(task_id)
        return [c.to_dict() for c in comments]
