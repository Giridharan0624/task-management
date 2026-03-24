from application.board.use_cases import DeleteBoardUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        board_repo = BoardDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = DeleteBoardUseCase(board_repo, user_repo)
        use_case.execute({"board_id": board_id}, auth.user_id, auth.system_role)
        return build_success(204, {})
    except Exception as e:
        return build_error(e)
