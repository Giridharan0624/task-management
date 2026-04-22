"""Single Lambda handling all /orgs/current/pipelines[/{pipelineId}] methods.

Pattern mirrors `roles_router.py` — one Lambda dispatches on httpMethod +
pathParameters so we add only one Lambda/Role/Policy + 2 method bindings
when wired into CDK. With the stack at 494/500 resources, keeping this
collapsed is non-negotiable.

Dispatch rules:
  GET    /orgs/current/pipelines                  → list_pipelines
  POST   /orgs/current/pipelines                  → create_pipeline
  PUT    /orgs/current/pipelines/{pipelineId}     → update_pipeline
  DELETE /orgs/current/pipelines/{pipelineId}     → delete_pipeline

NOTE: not yet attached to API Gateway. The CDK wire-up lands alongside
the nested-stack refactor (stack cap too tight to add routes today).
Handlers are deployable once that refactor is in.
"""
import json
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from contexts.org.domain import permissions as P
from contexts.org.domain.default_pipelines import build_default_pipelines
from contexts.org.domain.pipeline import Pipeline, PipelineStatus
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


# ------- Request models -------------------------------------------------

class StatusPayload(BaseModel):
    id: str = Field(min_length=1, max_length=32)
    label: str = Field(min_length=1, max_length=50)
    color: str = "#94A3B8"
    is_terminal: bool = False


class CreatePipelineRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    statuses: list[StatusPayload] = Field(min_length=1, max_length=20)
    is_default: bool = False


class UpdatePipelineRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    statuses: Optional[list[StatusPayload]] = Field(default=None, min_length=1, max_length=20)
    is_default: Optional[bool] = None


# ------- Dispatch -------------------------------------------------------

def handler(event, context):
    try:
        method = (event or {}).get("httpMethod", "").upper()
        path_params = (event or {}).get("pathParameters") or {}
        pipeline_id = (path_params.get("pipelineId") or "").strip()

        if method == "GET" and not pipeline_id:
            return _list(event)
        if method == "POST" and not pipeline_id:
            return _create(event)
        if method == "PUT" and pipeline_id:
            return _update(event, pipeline_id)
        if method == "DELETE" and pipeline_id:
            return _delete(event, pipeline_id)

        return build_success(405, {"error": f"Method {method} not allowed on this resource"})
    except Exception as e:
        return build_error(e)


# ------- GET /orgs/current/pipelines -----------------------------------

def _list(event):
    auth = extract_auth_context(event)
    repo = OrgDynamoRepository()
    pipelines = repo.list_pipelines(auth.org_id)
    if not pipelines:
        # Same lazy-backfill behavior as the original list_pipelines handler.
        pipelines = [p.to_dict() for p in build_default_pipelines(auth.org_id)]
    return build_success(200, {"pipelines": pipelines})


# ------- POST /orgs/current/pipelines ----------------------------------

_ID_CLEAN_RE = re.compile(r"[^A-Z0-9]+")


def _slugify(name: str, upper: bool = True) -> str:
    s = name.strip()
    if upper:
        s = s.upper()
    s = _ID_CLEAN_RE.sub("_", s).strip("_")
    return s[:32]


def _create(event):
    auth = extract_auth_context(event)
    require(auth, P.SETTINGS_EDIT)

    req = validate_body(CreatePipelineRequest, event.get("body"))
    pipeline_id = _slugify(req.name)
    if not pipeline_id:
        raise ValidationError("Pipeline name must contain alphanumeric characters.")

    repo = OrgDynamoRepository()
    existing = repo.list_pipelines(auth.org_id)
    if any(p["pipeline_id"] == pipeline_id for p in existing):
        raise ValidationError(
            f"A pipeline with id '{pipeline_id}' already exists."
        )

    # If is_default=True, clear the default flag on any other pipeline.
    # Also: if this is the first pipeline being created, force default=True
    # so the kanban always has something to fall back to.
    is_default = bool(req.is_default) or len(existing) == 0
    if is_default:
        for p in existing:
            if p.get("is_default"):
                p["is_default"] = False
                p["updated_at"] = datetime.now(timezone.utc).isoformat()
                repo.save_pipeline(auth.org_id, p)

    statuses = [
        PipelineStatus(
            id=s.id, label=s.label, color=s.color,
            order=i, is_terminal=bool(s.is_terminal),
        )
        for i, s in enumerate(req.statuses)
    ]
    pipeline = Pipeline.create(
        org_id=auth.org_id,
        pipeline_id=pipeline_id,
        name=req.name.strip(),
        statuses=statuses,
        is_default=is_default,
    )
    repo.save_pipeline(auth.org_id, pipeline.to_dict())
    return build_success(201, pipeline.to_dict())


# ------- PUT /orgs/current/pipelines/{pipelineId} ---------------------

def _update(event, pipeline_id: str):
    auth = extract_auth_context(event)
    require(auth, P.SETTINGS_EDIT)

    repo = OrgDynamoRepository()
    existing = _find_pipeline(repo, auth.org_id, pipeline_id)

    req = validate_body(UpdatePipelineRequest, event.get("body"))
    updated = dict(existing)

    if req.name is not None:
        updated["name"] = req.name.strip()

    if req.statuses is not None:
        updated["statuses"] = [
            {
                "id": s.id,
                "label": s.label,
                "color": s.color,
                "order": i,
                "is_terminal": bool(s.is_terminal),
            }
            for i, s in enumerate(req.statuses)
        ]

    if req.is_default is True and not existing.get("is_default"):
        # Promoting to default — clear the flag on whoever has it now.
        for p in repo.list_pipelines(auth.org_id):
            if p.get("is_default") and p["pipeline_id"] != pipeline_id:
                p["is_default"] = False
                p["updated_at"] = datetime.now(timezone.utc).isoformat()
                repo.save_pipeline(auth.org_id, p)
        updated["is_default"] = True
    elif req.is_default is False and existing.get("is_default"):
        # Disallow demoting the only default — at least one pipeline
        # must remain the default so the kanban has a fallback.
        defaults = [
            p for p in repo.list_pipelines(auth.org_id)
            if p.get("is_default") and p["pipeline_id"] != pipeline_id
        ]
        if not defaults:
            raise ValidationError(
                "Cannot unset the default flag — at least one pipeline "
                "must be marked default. Promote another pipeline first."
            )
        updated["is_default"] = False

    updated["updated_at"] = datetime.now(timezone.utc).isoformat()
    repo.save_pipeline(auth.org_id, updated)
    return build_success(200, updated)


# ------- DELETE /orgs/current/pipelines/{pipelineId} ------------------

def _delete(event, pipeline_id: str):
    auth = extract_auth_context(event)
    require(auth, P.SETTINGS_EDIT)

    repo = OrgDynamoRepository()
    existing = _find_pipeline(repo, auth.org_id, pipeline_id)

    if existing.get("is_default"):
        # Force the caller to promote a replacement first — deleting the
        # default pipeline would leave the kanban with no fallback for
        # tasks referencing it.
        raise ValidationError(
            "Cannot delete the default pipeline. Promote another "
            "pipeline to default first."
        )

    # Guardrail: refuse if any task still references this pipeline.
    # Cheap scan of the task keyspace scoped to this org — acceptable
    # latency since admins rarely delete pipelines.
    if _has_tasks(auth.org_id, pipeline_id):
        raise ValidationError(
            f"Cannot delete — tasks still reference the '{pipeline_id}' "
            "pipeline. Reassign those tasks first."
        )

    repo.delete_pipeline(auth.org_id, pipeline_id)
    return build_success(200, {"pipeline_id": pipeline_id, "deleted": True})


# ------- helpers -------------------------------------------------------

def _find_pipeline(
    repo: OrgDynamoRepository, org_id: str, pipeline_id: str
) -> dict:
    for p in repo.list_pipelines(org_id):
        if p["pipeline_id"] == pipeline_id:
            return p
    raise NotFoundError("Pipeline not found.")


def _has_tasks(org_id: str, pipeline_id: str) -> bool:
    """True if any task record in this org still references `pipeline_id`
    via its `domain` attribute (legacy field name) or a future
    `pipeline_id` attribute."""
    from shared_kernel.dynamo_client import get_table
    from shared_kernel import tenant_keys
    from boto3.dynamodb.conditions import Attr, Key

    table = get_table()
    # Scoped scan: only items under ORG#{org}#PROJECT#* with SK starting
    # with TASK#. Pagination loop so we don't miss items.
    resp = table.scan(
        FilterExpression=(
            Attr("PK").begins_with(f"{tenant_keys.org_pk(org_id)}#PROJECT#")
            & Attr("SK").begins_with("TASK#")
            & (Attr("domain").eq(pipeline_id) | Attr("pipeline_id").eq(pipeline_id))
        ),
        Limit=1,
    )
    if resp.get("Items"):
        return True
    while "LastEvaluatedKey" in resp:
        resp = table.scan(
            FilterExpression=(
                Attr("PK").begins_with(f"{tenant_keys.org_pk(org_id)}#PROJECT#")
                & Attr("SK").begins_with("TASK#")
                & (Attr("domain").eq(pipeline_id) | Attr("pipeline_id").eq(pipeline_id))
            ),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
            Limit=1,
        )
        if resp.get("Items"):
            return True
    return False
