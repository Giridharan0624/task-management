import pytest
from domain.task.entities import Task
from domain.task.value_objects import TaskPriority, TaskDomain, DOMAIN_STATUSES, DOMAIN_PROGRESS


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
        assert task.status == "TODO"
        assert task.priority == TaskPriority.MEDIUM
        assert task.domain == "DEVELOPMENT"
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
            domain="DESIGNING",
            assigned_to=["u-002", "u-003"],
            assigned_by="u-001",
            estimated_hours=8.0,
        )
        assert task.project_id == "proj-abc"
        assert task.priority == TaskPriority.HIGH
        assert task.domain == "DESIGNING"
        assert task.assigned_to == ["u-002", "u-003"]

    def test_to_dict_serializes(self):
        task = Task.create(
            task_id="t-003",
            title="Write tests",
            created_by="u-001",
            deadline="2026-04-20",
            status="IN_PROGRESS",
            priority=TaskPriority.LOW,
            domain="RESEARCH",
        )
        d = task.to_dict()
        assert d["status"] == "IN_PROGRESS"
        assert d["priority"] == "LOW"
        assert d["domain"] == "RESEARCH"
        assert d["project_id"] == "DIRECT"

    def test_invalid_priority_rejected(self):
        with pytest.raises(ValueError):
            Task.create(
                task_id="t-005",
                title="Bad task",
                created_by="u-001",
                deadline="2026-04-20",
                priority="CRITICAL",
            )


class TestDomainStatuses:
    def test_all_domains_defined(self):
        assert len(TaskDomain) == 4
        assert set(d.value for d in TaskDomain) == {"DEVELOPMENT", "DESIGNING", "MANAGEMENT", "RESEARCH"}

    def test_all_domains_have_statuses(self):
        for domain in TaskDomain:
            assert domain.value in DOMAIN_STATUSES
            statuses = DOMAIN_STATUSES[domain.value]
            assert statuses[0] == "TODO"
            assert statuses[-1] == "DONE"
            assert len(statuses) >= 6

    def test_progress_scores_calculated(self):
        for domain in TaskDomain:
            scores = DOMAIN_PROGRESS[domain.value]
            assert scores["TODO"] == 0
            assert scores["DONE"] == 100
            # All scores should be 0-100
            for score in scores.values():
                assert 0 <= score <= 100

    def test_all_priorities(self):
        assert len(TaskPriority) == 3
        assert set(p.value for p in TaskPriority) == {"LOW", "MEDIUM", "HIGH"}
