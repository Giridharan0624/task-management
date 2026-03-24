from application.task.use_cases import DeleteTaskUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        task_id = path_params.get("taskId", "")
        task_repo = TaskDynamoRepository()
        board_repo = BoardDynamoRepository()
        use_case = DeleteTaskUseCase(task_repo, board_repo)
        use_case.execute({"board_id": board_id, "task_id": task_id}, auth.user_id)
        return build_success(204, {})
    except Exception as e:
        return build_error(e)
