from domain.task.entities import Task
from domain.task.value_objects import TaskStatus, TaskPriority


class TaskMapper:
    @staticmethod
    def to_domain(item: dict) -> Task:
        return Task(
            task_id=item["task_id"],
            board_id=item["board_id"],
            title=item["title"],
            description=item.get("description"),
            status=TaskStatus(item.get("status", TaskStatus.TODO.value)),
            priority=TaskPriority(item.get("priority", TaskPriority.MEDIUM.value)),
            assigned_to=item.get("assigned_to"),
            assigned_by=item.get("assigned_by"),
            created_by=item["created_by"],
            due_date=item.get("due_date"),
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def to_dynamo(task: Task) -> dict:
        item: dict = {
            "PK": f"BOARD#{task.board_id}",
            "SK": f"TASK#{task.task_id}",
            "GSI1PK": f"TASK#{task.task_id}",
            "GSI1SK": f"BOARD#{task.board_id}",
            "task_id": task.task_id,
            "board_id": task.board_id,
            "title": task.title,
            "status": task.status.value,
            "priority": task.priority.value,
            "created_by": task.created_by,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        if task.description is not None:
            item["description"] = task.description
        if task.due_date is not None:
            item["due_date"] = task.due_date
        if task.assigned_to is not None:
            item["assigned_to"] = task.assigned_to
            item["GSI2PK"] = f"ASSIGNEE#{task.assigned_to}"
            item["GSI2SK"] = f"TASK#{task.task_id}"
        if task.assigned_by is not None:
            item["assigned_by"] = task.assigned_by
        return item
