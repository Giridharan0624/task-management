from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.cognito.cognito_service import CognitoService
from application.user.use_cases import DeleteUserUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_id = event.get("pathParameters", {}).get("userId", "")
        user_repo = UserDynamoRepository()
        project_repo = ProjectDynamoRepository()
        cognito_service = CognitoService()
        use_case = DeleteUserUseCase(user_repo, cognito_service, project_repo)
        use_case.execute({"user_id": user_id}, auth.user_id, auth.system_role)
        return build_success(204, None)
    except Exception as e:
        return build_error(e)
