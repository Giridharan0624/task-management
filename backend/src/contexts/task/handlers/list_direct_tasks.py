"""List direct tasks (not in any project)."""
from contexts.org.domain import permissions as P
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import has_permission
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        task_repo = TaskDynamoRepository()
        user_repo = UserDynamoRepository()

        tasks = task_repo.find_by_project("DIRECT")

        # Privileged users see all direct tasks; members see only assigned.
        # has_permission (not require) — a member with no view-all access
        # silently gets the filtered view, not a 403.
        if has_permission(auth, P.TASK_VIEW_ALL):
            result = [t.to_dict() for t in tasks]
        else:
            result = [t.to_dict() for t in tasks if auth.user_id in t.assigned_to]

        # Enrich with assignee names
        name_cache: dict[str, str] = {}
        for t in result:
            names = []
            for uid in t.get("assigned_to", []):
                if uid not in name_cache:
                    u = user_repo.find_by_id(uid)
                    name_cache[uid] = u.name if u else uid
                names.append(name_cache[uid])
            t["assignee_names"] = names

        return build_success(200, result)
    except Exception as e:
        return build_error(e)
