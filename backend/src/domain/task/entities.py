from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from domain.task.value_objects import TaskStatus, TaskPriority


class Task(BaseModel):
    task_id: str
    board_id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to: Optional[str] = None
    assigned_by: Optional[str] = None
    created_by: str
    due_date: Optional[str] = None
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        task_id: str,
        board_id: str,
        title: str,
        created_by: str,
        description: Optional[str] = None,
        status: TaskStatus = TaskStatus.TODO,
        priority: TaskPriority = TaskPriority.MEDIUM,
        assigned_to: Optional[str] = None,
        assigned_by: Optional[str] = None,
        due_date: Optional[str] = None,
    ) -> "Task":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            task_id=task_id,
            board_id=board_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            created_by=created_by,
            due_date=due_date,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "board_id": self.board_id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "priority": self.priority.value,
            "assigned_to": self.assigned_to,
            "assigned_by": self.assigned_by,
            "created_by": self.created_by,
            "due_date": self.due_date,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
