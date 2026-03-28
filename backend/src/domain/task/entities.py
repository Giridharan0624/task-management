from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from domain.task.value_objects import TaskStatus, TaskPriority


class Task(BaseModel):
    task_id: str
    project_id: str = "DIRECT"
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to: list[str] = []
    assigned_by: Optional[str] = None
    created_by: str
    deadline: str
    estimated_hours: Optional[float] = None
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        task_id: str,
        title: str,
        created_by: str,
        deadline: str,
        project_id: str = "DIRECT",
        description: Optional[str] = None,
        status: TaskStatus = TaskStatus.TODO,
        priority: TaskPriority = TaskPriority.MEDIUM,
        assigned_to: list[str] | None = None,
        assigned_by: Optional[str] = None,
        estimated_hours: Optional[float] = None,
    ) -> "Task":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            task_id=task_id,
            project_id=project_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            assigned_to=assigned_to or [],
            assigned_by=assigned_by,
            created_by=created_by,
            deadline=deadline,
            estimated_hours=estimated_hours,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "project_id": self.project_id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "priority": self.priority.value,
            "assigned_to": self.assigned_to,
            "assigned_by": self.assigned_by,
            "created_by": self.created_by,
            "deadline": self.deadline,
            "estimated_hours": self.estimated_hours,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
