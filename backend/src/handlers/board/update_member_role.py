from pydantic import BaseModel

from application.board.use_cases import UpdateMemberRoleUseCase
from domain.board.value_objects import BoardRole
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class UpdateMemberRoleRequest(BaseModel):
    board_role: BoardRole


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        board_id = path_params.get("boardId", "")
        user_id = path_params.get("userId", "")
        body = validate_body(UpdateMemberRoleRequest, event.get("body"))
        dto = body.model_dump()
        dto["board_id"] = board_id
        dto["user_id"] = user_id
        board_repo = BoardDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = UpdateMemberRoleUseCase(board_repo, user_repo)
        result = use_case.execute(dto, auth.user_id, auth.system_role)
        return build_success(200, result)
    except Exception as e:
        return build_error(e)
