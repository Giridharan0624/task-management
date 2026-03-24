from domain.board.entities import Board, BoardMember
from domain.board.value_objects import BoardRole


class BoardMapper:
    @staticmethod
    def board_to_domain(item: dict) -> Board:
        return Board(
            board_id=item["board_id"],
            name=item["name"],
            description=item.get("description"),
            created_by=item["created_by"],
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def board_to_dynamo(board: Board) -> dict:
        item: dict = {
            "PK": f"BOARD#{board.board_id}",
            "SK": "METADATA",
            "board_id": board.board_id,
            "name": board.name,
            "created_by": board.created_by,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
        }
        if board.description is not None:
            item["description"] = board.description
        return item

    @staticmethod
    def member_to_domain(item: dict) -> BoardMember:
        return BoardMember(
            board_id=item["board_id"],
            user_id=item["user_id"],
            board_role=BoardRole(item["board_role"]),
            joined_at=item["joined_at"],
        )

    @staticmethod
    def member_to_dynamo(member: BoardMember) -> dict:
        return {
            "PK": f"BOARD#{member.board_id}",
            "SK": f"MEMBER#{member.user_id}",
            "GSI1PK": f"USER#{member.user_id}",
            "GSI1SK": f"BOARD#{member.board_id}",
            "board_id": member.board_id,
            "user_id": member.user_id,
            "board_role": member.board_role.value,
            "joined_at": member.joined_at,
        }
