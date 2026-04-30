"""Provider-agnostic use case: turn a NormalizedItem from any connector into
a TaskFlow Task — creating one on first sight or updating the linked one
on subsequent webhooks.

Lives in the integration platform; the only dependency on the existing
`task` context is the public `ITaskRepository` interface and the `Task`
entity. No reverse imports.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Protocol

from contexts.integrations.domain.entities import ExternalLink, Integration
from contexts.integrations.domain.normalized import NormalizedItem
from contexts.integrations.domain.repository import IExternalLinkRepository
from contexts.integrations.domain.value_objects import ItemType
from contexts.task.domain.entities import Task
from contexts.task.domain.repository import ITaskRepository
from contexts.task.domain.value_objects import TaskPriority


log = logging.getLogger(__name__)


# Provider-agnostic NormalizedItem statuses → TaskFlow Task.status strings.
_STATUS_MAP = {
    "OPEN": "TODO",
    "PENDING": "IN_PROGRESS",
    "IN_PROGRESS": "IN_PROGRESS",
    "RESOLVED": "DONE",
    "CLOSED": "DONE",
    "DONE": "DONE",
}

_PRIORITY_MAP = {
    "LOW": TaskPriority.LOW,
    "MEDIUM": TaskPriority.MEDIUM,
    "HIGH": TaskPriority.HIGH,
    "URGENT": TaskPriority.HIGH,  # TaskFlow has no URGENT; nearest match.
}


class _AssigneeResolver(Protocol):
    def __call__(
        self,
        *,
        integration: Integration,
        agent_email: Optional[str],
    ) -> Optional[str]: ...


def upsert_task_from_external(
    *,
    integration: Integration,
    item: NormalizedItem,
    agent_email: Optional[str] = None,
    task_repo: ITaskRepository,
    link_repo: IExternalLinkRepository,
    resolve_assignee: Optional[_AssigneeResolver] = None,
    fallback_creator_id: str = "system:integration",
) -> tuple[Task, bool]:
    """Idempotent: returns (task, created_flag).

    If an ExternalLink already exists for (provider, external_id), update
    the corresponding task. Otherwise create a new task in the integration's
    `linked_project_id` (or DIRECT) and persist the link.
    """
    existing = link_repo.find_by_external(integration.provider, item.external_id)

    assignee_id: Optional[str] = None
    if resolve_assignee is not None and agent_email is not None:
        try:
            assignee_id = resolve_assignee(
                integration=integration, agent_email=agent_email
            )
        except Exception:
            log.exception(
                "resolve_assignee raised for %s; leaving unassigned",
                item.external_id,
            )

    title = item.title or f"[{integration.provider}] ticket {item.external_id}"
    description = item.description or ""
    status = _STATUS_MAP.get((item.status or "").upper(), "TODO")
    priority = _PRIORITY_MAP.get((item.priority or "").upper(), TaskPriority.MEDIUM)
    deadline = item.due_at or item.updated_at or _now_iso()
    project_id = integration.linked_project_id or "DIRECT"
    assigned_to = [assignee_id] if assignee_id else []

    if existing is not None:
        task = task_repo.find_by_id(existing.item_id)
        if task is None:
            # Link points at a deleted task — re-create defensively.
            return _create(
                integration,
                item,
                project_id,
                title,
                description,
                status,
                priority,
                assigned_to,
                deadline,
                fallback_creator_id,
                task_repo,
                link_repo,
            )
        task.title = title
        task.description = description or task.description
        task.status = status
        task.priority = priority
        task.deadline = deadline
        if assigned_to:
            task.assigned_to = assigned_to
        task.updated_at = _now_iso()
        task_repo.update(task)

        existing.last_pulled_at = _now_iso()
        existing.external_url = item.external_url or existing.external_url
        link_repo.update(existing)
        return task, False

    return _create(
        integration,
        item,
        project_id,
        title,
        description,
        status,
        priority,
        assigned_to,
        deadline,
        fallback_creator_id,
        task_repo,
        link_repo,
    )


def _create(
    integration: Integration,
    item: NormalizedItem,
    project_id: str,
    title: str,
    description: str,
    status: str,
    priority: TaskPriority,
    assigned_to: list[str],
    deadline: str,
    fallback_creator_id: str,
    task_repo: ITaskRepository,
    link_repo: IExternalLinkRepository,
) -> tuple[Task, bool]:
    task = Task.create(
        task_id=uuid.uuid4().hex,
        title=title,
        created_by=fallback_creator_id,
        deadline=deadline,
        project_id=project_id,
        description=description,
        status=status,
        priority=priority,
        assigned_to=assigned_to,
    )
    task_repo.save(task)

    link = ExternalLink.create(
        org_id=integration.org_id,
        provider=integration.provider,
        integration_id=integration.integration_id,
        item_type=ItemType.TASK,
        item_id=task.task_id,
        external_id=item.external_id,
        external_url=item.external_url,
    )
    link.last_pulled_at = _now_iso()
    link_repo.save(link)
    return task, True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
