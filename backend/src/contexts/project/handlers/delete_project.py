from contexts.project.application.use_cases import DeleteProjectUseCase
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.project.infrastructure.dynamo_repository import ProjectDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = DeleteProjectUseCase(project_repo, user_repo)
        use_case.execute({"project_id": project_id}, auth.user_id, auth.system_role)
        return build_success(204, {})
    except Exception as e:
        return build_error(e)
