from application.board.use_cases import ListBoardsForUserUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        board_repo = BoardDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = ListBoardsForUserUseCase(board_repo, user_repo)
        result = use_case.execute({}, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
