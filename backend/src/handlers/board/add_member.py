from pydantic import BaseModel

from application.board.use_cases import AddBoardMemberUseCase
from domain.board.value_objects import BoardRole
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class AddMemberRequest(BaseModel):
    user_id: str
    board_role: BoardRole = BoardRole.MEMBER


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        body = validate_body(AddMemberRequest, event.get("body"))
        dto = body.model_dump()
        dto["board_id"] = board_id
        board_repo = BoardDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = AddBoardMemberUseCase(board_repo, user_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
