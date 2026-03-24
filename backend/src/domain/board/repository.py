from abc import ABC, abstractmethod
from typing import Optional

from domain.board.entities import Board, BoardMember


class IBoardRepository(ABC):
    @abstractmethod
    def find_by_id(self, board_id: str) -> Optional[Board]:
        ...

    @abstractmethod
    def save(self, board: Board) -> None:
        ...

    @abstractmethod
    def delete(self, board_id: str) -> None:
        ...

    @abstractmethod
    def find_boards_for_user(self, user_id: str) -> list[Board]:
        ...

    @abstractmethod
    def save_member(self, member: BoardMember) -> None:
        ...

    @abstractmethod
    def remove_member(self, board_id: str, user_id: str) -> None:
        ...

    @abstractmethod
    def find_member(self, board_id: str, user_id: str) -> Optional[BoardMember]:
        ...

    @abstractmethod
    def find_members(self, board_id: str) -> list[BoardMember]:
        ...

    @abstractmethod
    def delete_all_board_data(self, board_id: str) -> None:
        ...
