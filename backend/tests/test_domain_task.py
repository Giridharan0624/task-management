"""Unit tests for the Task entity.

Import paths updated for the post-migration layout (`contexts.*`).
Adds coverage for the Phase-5 dual-read: `pipeline_id` alias on
`Task.domain` with both keys emitted in `to_dict()`.
"""
import pytest

from contexts.task.domain.entities import Task
from contexts.task.domain.value_objects import (
    DOMAIN_PROGRESS,
    DOMAIN_STATUSES,
    TaskDomain,
    TaskPriority,
)


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
        # Tasks without a project are stored under the sentinel "DIRECT"
        # so the kanban + repos can treat them uniformly with project tasks.
        assert task.project_id == "DIRECT"
        assert task.status == "TODO"
        assert task.priority == TaskPriority.MEDIUM
        assert task.domain == "DEVELOPMENT"
        assert task.pipeline_id == "DEVELOPMENT"  # property mirrors `domain`
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

    def test_pipeline_id_alias_reads(self):
        # Phase 5 dual-read: the entity accepts `pipeline_id` as a
        # Pydantic alias for `domain`, so repositories can hydrate from
        # either the legacy `domain` attribute or the new `pipeline_id`.
        task = Task(
            task_id="t-010",
            project_id="p",
            title="x",
            created_by="u",
            deadline="2026-01-01",
            pipeline_id="SALES",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        assert task.domain == "SALES"
        assert task.pipeline_id == "SALES"

    def test_to_dict_emits_both_pipeline_names(self):
        # During the rename window `to_dict()` writes both `domain` and
        # `pipeline_id` so no consumer breaks before the backfill lands.
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
        assert d["pipeline_id"] == "RESEARCH"
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
    def test_all_four_domains_defined(self):
        # Phase 5 seeded these as the four default pipelines. Tenants
        # can create more via `/settings/pipelines`; the enum stays
        # constant because legacy tasks reference these strings.
        assert len(TaskDomain) == 4
        assert set(d.value for d in TaskDomain) == {
            "DEVELOPMENT",
            "DESIGNING",
            "MANAGEMENT",
            "RESEARCH",
        }

    def test_all_domains_have_status_pipelines(self):
        for domain in TaskDomain:
            assert domain.value in DOMAIN_STATUSES
            statuses = DOMAIN_STATUSES[domain.value]
            # Every pipeline starts at TODO and ends at DONE — the
            # progress calculator assumes this ordering.
            assert statuses[0] == "TODO"
            assert statuses[-1] == "DONE"
            assert len(statuses) >= 6

    def test_progress_scores_bounded(self):
        for domain in TaskDomain:
            scores = DOMAIN_PROGRESS[domain.value]
            assert scores["TODO"] == 0
            assert scores["DONE"] == 100
            for score in scores.values():
                assert 0 <= score <= 100

    def test_all_three_priorities(self):
        assert len(TaskPriority) == 3
        assert set(p.value for p in TaskPriority) == {"LOW", "MEDIUM", "HIGH"}
