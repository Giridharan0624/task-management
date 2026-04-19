"""Phase 5 — default pipelines seeded at org creation.

Mirrors the four hardcoded NEUROSTACK pipelines so existing tasks keep
working unchanged after the per-tenant Pipeline migration. Pipeline IDs
match the legacy `TaskDomain` enum values (DEVELOPMENT/DESIGNING/
MANAGEMENT/RESEARCH) so existing task rows referencing those strings
resolve to the right Pipeline record without backfill.
"""
from contexts.org.domain.pipeline import Pipeline, PipelineStatus


def _statuses(rows: list[tuple[str, str, str]]) -> list[PipelineStatus]:
    """Build PipelineStatus list from `(id, label, color)` tuples; the
    last status is automatically marked terminal."""
    out: list[PipelineStatus] = []
    for i, (sid, label, color) in enumerate(rows):
        out.append(
            PipelineStatus(
                id=sid,
                label=label,
                color=color,
                order=i,
                is_terminal=(i == len(rows) - 1),
            )
        )
    return out


_DEVELOPMENT = _statuses([
    ("TODO", "To Do", "#F59E0B"),
    ("IN_PROGRESS", "In Progress", "#3B82F6"),
    ("DEVELOPED", "Developed", "#8B5CF6"),
    ("CODE_REVIEW", "Code Review", "#A855F7"),
    ("TESTING", "Testing", "#F97316"),
    ("DEBUGGING", "Debugging", "#EF4444"),
    ("FINAL_TESTING", "Final Testing", "#EC4899"),
    ("DONE", "Done", "#10B981"),
])

_DESIGNING = _statuses([
    ("TODO", "To Do", "#F59E0B"),
    ("IN_PROGRESS", "In Progress", "#3B82F6"),
    ("WIREFRAME", "Wireframe", "#64748B"),
    ("DESIGN", "Design", "#6366F1"),
    ("REVIEW", "Review", "#06B6D4"),
    ("REVISION", "Revision", "#F43F5E"),
    ("APPROVED", "Approved", "#10B981"),
    ("DONE", "Done", "#10B981"),
])

_MANAGEMENT = _statuses([
    ("TODO", "To Do", "#F59E0B"),
    ("PLANNING", "Planning", "#6366F1"),
    ("IN_PROGRESS", "In Progress", "#3B82F6"),
    ("EXECUTION", "Execution", "#3B82F6"),
    ("REVIEW", "Review", "#06B6D4"),
    ("DONE", "Done", "#10B981"),
])

_RESEARCH = _statuses([
    ("TODO", "To Do", "#F59E0B"),
    ("IN_PROGRESS", "In Progress", "#3B82F6"),
    ("RESEARCH", "Research", "#8B5CF6"),
    ("ANALYSIS", "Analysis", "#14B8A6"),
    ("DOCUMENTATION", "Documentation", "#F97316"),
    ("REVIEW", "Review", "#06B6D4"),
    ("DONE", "Done", "#10B981"),
])


def build_default_pipelines(org_id: str) -> list[Pipeline]:
    return [
        Pipeline.create(
            org_id=org_id,
            pipeline_id="DEVELOPMENT",
            name="Development",
            statuses=_DEVELOPMENT,
            is_default=True,
        ),
        Pipeline.create(
            org_id=org_id,
            pipeline_id="DESIGNING",
            name="Designing",
            statuses=_DESIGNING,
        ),
        Pipeline.create(
            org_id=org_id,
            pipeline_id="MANAGEMENT",
            name="Management",
            statuses=_MANAGEMENT,
        ),
        Pipeline.create(
            org_id=org_id,
            pipeline_id="RESEARCH",
            name="Research",
            statuses=_RESEARCH,
        ),
    ]
