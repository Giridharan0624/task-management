from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from domain.board.value_objects import BoardRole


class Board(BaseModel):
    board_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str

    @classmethod
    def create(
        cls,
        board_id: str,
        name: str,
        created_by: str,
        description: Optional[str] = None,
    ) -> "Board":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            board_id=board_id,
            name=name,
            description=description,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "board_id": self.board_id,
            "name": self.name,
            "description": self.description,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class BoardMember(BaseModel):
    board_id: str
    user_id: str
    board_role: BoardRole
    joined_at: str

    @classmethod
    def create(
        cls,
        board_id: str,
        user_id: str,
        board_role: BoardRole = BoardRole.MEMBER,
    ) -> "BoardMember":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            board_id=board_id,
            user_id=user_id,
            board_role=board_role,
            joined_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "board_id": self.board_id,
            "user_id": self.user_id,
            "board_role": self.board_role.value,
            "joined_at": self.joined_at,
        }
