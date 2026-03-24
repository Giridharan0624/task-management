from typing import Optional

from pydantic import BaseModel

from application.board.use_cases import CreateBoardUseCase
from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from handlers.shared.validate_body import validate_body
from infrastructure.dynamodb.board_repository import BoardDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository


class CreateBoardRequest(BaseModel):
    name: str
    description: Optional[str] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        body = validate_body(CreateBoardRequest, event.get("body"))
        board_repo = BoardDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = CreateBoardUseCase(board_repo, user_repo)
        result = use_case.execute(body.model_dump(), auth.user_id, auth.system_role)
        return build_success(201, result)
    except Exception as e:
        return build_error(e)
