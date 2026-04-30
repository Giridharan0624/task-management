"""Provider-agnostic assignee resolution.

Given an external agent's email and the integration's assignee_mode, return
the TaskFlow user_id (or None for unassigned). Logging-only side effects: this
function does not raise on missing users — that's a normal product-level
condition handled by the configured mode.
"""
from __future__ import annotations

import logging
from typing import Optional, Protocol

from contexts.integrations.domain.entities import Integration
from contexts.integrations.domain.value_objects import AssigneeMode


log = logging.getLogger(__name__)


class _UserLookup(Protocol):
    def find_by_email(self, email: str): ...


def resolve_assignee(
    *,
    integration: Integration,
    agent_email: Optional[str],
    user_repo: _UserLookup,
    plan_tier: str = "pro",
    on_invite_request: Optional[callable] = None,
) -> Optional[str]:
    """Map an external agent email to a TaskFlow user_id under the integration's
    assignee_mode policy. Returns None when the resolution leaves the item
    unassigned. `on_invite_request(email)` is the seam for AUTO_INVITE; the
    actual invite email is sent by the existing `org` context — this helper
    only signals intent."""
    if not agent_email:
        return None

    user = user_repo.find_by_email(agent_email)
    if user is not None:
        return getattr(user, "user_id", None)

    mode = integration.assignee_mode
    if mode == AssigneeMode.STRICT:
        log.info(
            "assignee resolution: no TaskFlow user for %s (strict); leaving unassigned",
            agent_email,
        )
        return None

    if mode == AssigneeMode.FALLBACK:
        return integration.fallback_assignee_id

    if mode == AssigneeMode.AUTO_INVITE:
        if plan_tier.lower() != "enterprise":
            log.info(
                "assignee resolution: auto_invite blocked by plan %s for %s",
                plan_tier,
                agent_email,
            )
            return None
        if on_invite_request is not None:
            try:
                on_invite_request(agent_email)
            except Exception:
                log.exception("on_invite_request failed for %s", agent_email)
        return None

    log.warning("assignee resolution: unknown mode %s; defaulting to unassigned", mode)
    return None
