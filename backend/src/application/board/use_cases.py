from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.board.entities import Board, BoardMember
from domain.board.repository import IBoardRepository
from domain.board.value_objects import BoardRole
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError, ValidationError


class CreateBoardUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role != SystemRole.ADMIN.value:
            raise AuthorizationError("Only system admins can create boards")

        board_id = str(uuid.uuid4())
        board = Board.create(
            board_id=board_id,
            name=dto["name"],
            created_by=caller_user_id,
            description=dto.get("description"),
        )
        self._board_repo.save(board)

        # Auto-add creator as board ADMIN
        member = BoardMember.create(
            board_id=board_id,
            user_id=caller_user_id,
            board_role=BoardRole.ADMIN,
        )
        self._board_repo.save_member(member)

        return board.to_dict()


class GetBoardUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        board_id = dto["board_id"]
        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member and caller_system_role != SystemRole.ADMIN.value:
            raise AuthorizationError("You are not a member of this board")

        members = self._board_repo.find_members(board_id)
        return {**board.to_dict(), "members": [m.to_dict() for m in members]}


class ListBoardsForUserUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> list[dict]:
        boards = self._board_repo.find_boards_for_user(caller_user_id)
        return [b.to_dict() for b in boards]


class DeleteBoardUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> None:
        board_id = dto["board_id"]
        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role != BoardRole.ADMIN:
            if caller_system_role != SystemRole.ADMIN.value:
                raise AuthorizationError("Only board admins can delete this board")

        self._board_repo.delete_all_board_data(board_id)


class AddBoardMemberUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        board_id = dto["board_id"]
        target_user_id = dto["user_id"]
        board_role_value = dto.get("board_role", BoardRole.MEMBER.value)

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role != BoardRole.ADMIN:
            raise AuthorizationError("Only board admins can add members")

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        try:
            board_role = BoardRole(board_role_value)
        except ValueError:
            raise ValidationError(f"Invalid board role: {board_role_value}")

        member = BoardMember.create(
            board_id=board_id,
            user_id=target_user_id,
            board_role=board_role,
        )
        self._board_repo.save_member(member)
        return member.to_dict()


class RemoveBoardMemberUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> None:
        board_id = dto["board_id"]
        target_user_id = dto["user_id"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role != BoardRole.ADMIN:
            raise AuthorizationError("Only board admins can remove members")

        self._board_repo.remove_member(board_id, target_user_id)


class UpdateMemberRoleUseCase:
    def __init__(self, board_repo: IBoardRepository, user_repo: IUserRepository):
        self._board_repo = board_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        board_id = dto["board_id"]
        target_user_id = dto["user_id"]
        new_role_value = dto["board_role"]

        board = self._board_repo.find_by_id(board_id)
        if not board:
            raise NotFoundError(f"Board {board_id} not found")

        caller_member = self._board_repo.find_member(board_id, caller_user_id)
        if not caller_member or caller_member.board_role != BoardRole.ADMIN:
            raise AuthorizationError("Only board admins can update member roles")

        target_member = self._board_repo.find_member(board_id, target_user_id)
        if not target_member:
            raise NotFoundError(f"Member {target_user_id} not found in board {board_id}")

        try:
            new_role = BoardRole(new_role_value)
        except ValueError:
            raise ValidationError(f"Invalid board role: {new_role_value}")

        updated_member = BoardMember(
            board_id=target_member.board_id,
            user_id=target_member.user_id,
            board_role=new_role,
            joined_at=target_member.joined_at,
        )
        self._board_repo.save_member(updated_member)
        return updated_member.to_dict()
