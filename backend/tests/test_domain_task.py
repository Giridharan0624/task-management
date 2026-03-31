import pytest
from domain.task.entities import Task
from domain.task.value_objects import TaskStatus, TaskPriority


class TestTaskEntity:
    def test_create_default_task(self):
        task = Task.create(
            task_id="t-001",
            title="Fix login bug",
            created_by="u-001",
            deadline="2026-04-15",
        )
        assert task.task_id == "t-001"
        assert task.title == "Fix login bug"
        assert task.project_id == "DIRECT"
        assert task.status == TaskStatus.TODO
        assert task.priority == TaskPriority.MEDIUM
        assert task.assigned_to == []
        assert task.created_at == task.updated_at

    def test_create_project_task(self):
        task = Task.create(
            task_id="t-002",
            title="Design dashboard",
            created_by="u-001",
            deadline="2026-05-01",
            project_id="proj-abc",
            priority=TaskPriority.HIGH,
            assigned_to=["u-002", "u-003"],
            assigned_by="u-001",
            estimated_hours=8.0,
        )
        assert task.project_id == "proj-abc"
        assert task.priority == TaskPriority.HIGH
        assert task.assigned_to == ["u-002", "u-003"]
        assert task.assigned_by == "u-001"
        assert task.estimated_hours == 8.0

    def test_to_dict_serializes_enums(self):
        task = Task.create(
            task_id="t-003",
            title="Write tests",
            created_by="u-001",
            deadline="2026-04-20",
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.LOW,
        )
        d = task.to_dict()
        assert d["status"] == "IN_PROGRESS"
        assert d["priority"] == "LOW"
        assert d["project_id"] == "DIRECT"
        assert d["description"] is None

    def test_invalid_status_rejected(self):
        with pytest.raises(ValueError):
            Task.create(
                task_id="t-004",
                title="Bad task",
                created_by="u-001",
                deadline="2026-04-20",
                status="INVALID",
            )

    def test_invalid_priority_rejected(self):
        with pytest.raises(ValueError):
            Task.create(
                task_id="t-005",
                title="Bad task",
                created_by="u-001",
                deadline="2026-04-20",
                priority="CRITICAL",
            )


class TestTaskEnums:
    def test_all_statuses(self):
        assert len(TaskStatus) == 3
        assert set(s.value for s in TaskStatus) == {"TODO", "IN_PROGRESS", "DONE"}

    def test_all_priorities(self):
        assert len(TaskPriority) == 3
        assert set(p.value for p in TaskPriority) == {"LOW", "MEDIUM", "HIGH"}
