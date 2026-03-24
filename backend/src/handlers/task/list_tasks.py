from application.task.use_cases import ListTasksForBoardUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        task_repo = TaskDynamoRepository()
        board_repo = BoardDynamoRepository()
        use_case = ListTasksForBoardUseCase(task_repo, board_repo)
        result = use_case.execute({"board_id": board_id}, auth.user_id)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
