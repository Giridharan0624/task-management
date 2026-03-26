from handlers.shared.response import build_success, build_error
from handlers.shared.auth_context import extract_auth_context
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository
from application.user.use_cases import GetUserProgressUseCase


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        user_id = event.get("pathParameters", {}).get("userId", "")
        user_repo = UserDynamoRepository()
        board_repo = BoardDynamoRepository()
        task_repo = TaskDynamoRepository()
        use_case = GetUserProgressUseCase(user_repo, board_repo, task_repo)
        result = use_case.execute({"user_id": user_id}, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
