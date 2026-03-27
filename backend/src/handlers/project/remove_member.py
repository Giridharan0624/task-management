from application.project.use_cases import RemoveProjectMemberUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")
        user_id = path_params.get("userId", "")
        project_repo = ProjectDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = RemoveProjectMemberUseCase(project_repo, user_repo)
        use_case.execute({"project_id": project_id, "user_id": user_id}, auth.user_id, auth.system_role)
        return build_success(204, {})
    except Exception as e:
        return build_error(e)
