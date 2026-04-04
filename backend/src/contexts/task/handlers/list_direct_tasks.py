"""List direct tasks (not in any project)."""
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.task.infrastructure.dynamo_repository import TaskDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from contexts.user.domain.value_objects import PRIVILEGED_ROLES


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        task_repo = TaskDynamoRepository()
        user_repo = UserDynamoRepository()

        tasks = task_repo.find_by_project("DIRECT")

        # Privileged users see all direct tasks; members see only assigned
        if auth.system_role in PRIVILEGED_ROLES:
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
