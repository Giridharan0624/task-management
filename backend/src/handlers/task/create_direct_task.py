"""Create a task directly assigned to a user, without a project."""
import uuid
from typing import Optional
from datetime import datetime, timezone

from pydantic import BaseModel

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.task_repository import TaskDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from domain.task.entities import Task
from domain.task.value_objects import TaskPriority
from domain.user.value_objects import PRIVILEGED_ROLES
from shared.errors import AuthorizationError, NotFoundError, ValidationError


class CreateDirectTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = None
    domain: Optional[str] = "DEVELOPMENT"
    deadline: str
    assigned_to: list[str]
    estimated_hours: Optional[float] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        if auth.system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only owners and admins can create direct tasks")

        body = validate_body(CreateDirectTaskRequest, event.get("body"))
        user_repo = UserDynamoRepository()
        task_repo = TaskDynamoRepository()

        if not body.assigned_to:
            raise ValidationError("At least one assignee is required")

        # Validate all assignees exist
        assignee_names = []
        for uid in body.assigned_to:
            user = user_repo.find_by_id(uid)
            if not user:
                raise NotFoundError(f"User {uid} not found")
            assignee_names.append(user.name)

        priority = TaskPriority.MEDIUM
        if body.priority:
            try:
                priority = TaskPriority(body.priority)
            except ValueError:
                raise ValidationError(f"Invalid priority: {body.priority}")

        task = Task.create(
            task_id=str(uuid.uuid4()),
            project_id="DIRECT",
            title=body.title,
            created_by=auth.user_id,
            description=body.description,
            status="TODO",
            domain=body.domain or "DEVELOPMENT",
            priority=priority,
            assigned_to=body.assigned_to,
            assigned_by=auth.user_id,
            deadline=body.deadline,
            estimated_hours=body.estimated_hours,
        )
        task_repo.save(task)
        return build_success(201, task.to_dict())
    except Exception as e:
        return build_error(e)
