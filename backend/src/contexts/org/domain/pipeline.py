"""Phase 5 — `Pipeline` aggregate.

A pipeline is a tenant-defined task workflow. Each org gets the four
NEUROSTACK pipelines (DEVELOPMENT/DESIGNING/MANAGEMENT/RESEARCH) seeded
at signup so the existing UX continues to work; tenants can create more
or rename steps without code changes.

A pipeline has an ordered list of `PipelineStatus` columns. Status IDs
are stable across renames (the label changes, the id stays) so existing
task records keep mapping to the right column.
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class PipelineStatus(BaseModel):
    id: str             # stable; e.g. "TODO", "IN_PROGRESS"
    label: str          # human label; freely editable
    color: str = "#94A3B8"  # hex; used by the kanban + status badge
    order: int = 0      # render order; lower first
    is_terminal: bool = False  # true for DONE-equivalent columns


class Pipeline(BaseModel):
    org_id: str
    pipeline_id: str
    name: str           # e.g. "Development", "Sales"
    statuses: list[PipelineStatus] = Field(default_factory=list)
    is_default: bool = False  # if True, picked when a task has no pipeline
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        org_id: str,
        pipeline_id: str,
        name: str,
        statuses: list[PipelineStatus],
        is_default: bool = False,
    ) -> "Pipeline":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            org_id=org_id,
            pipeline_id=pipeline_id,
            name=name,
            statuses=statuses,
            is_default=is_default,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "org_id": self.org_id,
            "pipeline_id": self.pipeline_id,
            "name": self.name,
            "is_default": self.is_default,
            "statuses": [s.model_dump() for s in self.statuses],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
