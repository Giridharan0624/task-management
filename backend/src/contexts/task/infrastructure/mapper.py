from contexts.task.domain.entities import Task
from contexts.task.domain.value_objects import TaskPriority
from shared_kernel import tenant_keys


class TaskMapper:
    @staticmethod
    def to_domain(item: dict) -> Task:
        raw_assigned = item.get("assigned_to")
        if raw_assigned is None:
            assigned_to = None
        elif isinstance(raw_assigned, list):
            assigned_to = raw_assigned
        else:
            assigned_to = [raw_assigned]

        return Task(
            task_id=item["task_id"],
            project_id=item["project_id"],
            title=item["title"],
            description=item.get("description"),
            status=item.get("status", "TODO"),
            priority=TaskPriority(item.get("priority", TaskPriority.MEDIUM.value)),
            domain=item.get("domain", "DEVELOPMENT"),
            assigned_to=assigned_to,
            assigned_by=item.get("assigned_by"),
            created_by=item["created_by"],
            deadline=item.get("deadline"),
            estimated_hours=float(item["estimated_hours"]) if item.get("estimated_hours") is not None else None,
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def to_dynamo(task: Task, org_id: str) -> dict:
        status_val = task.status if isinstance(task.status, str) else task.status.value if hasattr(task.status, 'value') else str(task.status)
        item: dict = {
            "PK": tenant_keys.project_pk(org_id, task.project_id),
            "SK": tenant_keys.task_sk(task.task_id),
            "GSI1PK": tenant_keys.task_lookup_gsi1pk(org_id, task.task_id),
            "GSI1SK": f"PROJECT#{task.project_id}",
            "org_id": org_id,
            "task_id": task.task_id,
            "project_id": task.project_id,
            "title": task.title,
            "status": status_val,
            "priority": task.priority.value,
            "domain": task.domain,
            "created_by": task.created_by,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        if task.description is not None:
            item["description"] = task.description
        if task.deadline is not None:
            item["deadline"] = task.deadline
        if task.assigned_to is not None:
            item["assigned_to"] = task.assigned_to
        if task.assigned_by is not None:
            item["assigned_by"] = task.assigned_by
        if task.estimated_hours is not None:
            item["estimated_hours"] = str(task.estimated_hours)
        return item
