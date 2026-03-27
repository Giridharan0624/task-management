from __future__ import annotations

import uuid

from domain.comment.entities import ProgressComment
from domain.comment.repository import ICommentRepository
from domain.project.repository import IProjectRepository
from domain.task.repository import ITaskRepository
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError


class CreateCommentUseCase:
    def __init__(self, comment_repo: ICommentRepository, task_repo: ITaskRepository):
        self._comment_repo = comment_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        task_id = dto["task_id"]

        task = self._task_repo.find_by_id(task_id)
        if not task:
            raise NotFoundError(f"Task {task_id} not found")

        # Caller must be assigned to the task OR be OWNER/ADMIN
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            if caller_user_id not in task.assigned_to:
                raise AuthorizationError("You must be assigned to this task to comment")

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

        # OWNER can see any. Others must be a project member.
        if caller_system_role != SystemRole.OWNER.value:
            member = self._project_repo.find_member(task.project_id, caller_user_id)
            if not member:
                raise AuthorizationError("You must be a project member to view comments")

        comments = self._comment_repo.find_by_task(task_id)
        return [c.to_dict() for c in comments]
