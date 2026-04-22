from pydantic import BaseModel

from contexts.task.application.use_cases import AssignTaskUseCase
from shared_kernel import notifications, webhooks
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository


class AssignTaskRequest(BaseModel):
    assigned_to: list[str]


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        task_id = path_params.get("taskId", "")
        body = validate_body(AssignTaskRequest, event.get("body"))
        dto = body.model_dump()
        dto["project_id"] = project_id
        dto["task_id"] = task_id
        task_repo = TaskDynamoRepository()
        project_repo = ProjectDynamoRepository()
        use_case = AssignTaskUseCase(task_repo, project_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)

        # Fire-and-forget notifications for each new assignee. We
        # don't know who was PREVIOUSLY assigned here (use-case
        # overwrites), so we notify every ID in the final list. A
        # future refinement would diff against the prior task state
        # to suppress duplicate pings when just adding someone to an
        # existing assignee list.
        title = result.get("title") or "Task"
        for assignee_id in body.assigned_to:
            if assignee_id == auth.user_id:
                continue  # don't notify yourself
            notifications.create(
                auth.org_id, assignee_id,
                type=notifications.TASK_ASSIGNED,
                title=f"Assigned: {title}",
                message=f"{auth.email} assigned you a task.",
                link=f"/projects/{project_id}",
                metadata={"task_id": task_id, "project_id": project_id},
            )
        # Outbound webhook — subscribers get the full task payload.
        webhooks.deliver(
            auth.org_id, webhooks.TASK_ASSIGNED,
            {
                "task_id": task_id,
                "project_id": project_id,
                "assigned_to": body.assigned_to,
                "assigned_by": auth.user_id,
                "task": result,
            },
        )
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
