from typing import Optional

from boto3.dynamodb.conditions import Key

from domain.board.entities import Board, BoardMember
from domain.board.repository import IBoardRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.board_mapper import BoardMapper


class BoardDynamoRepository(IBoardRepository):
    def __init__(self):
        self._table = get_table()

    def find_by_id(self, board_id: str) -> Optional[Board]:
        response = self._table.get_item(
            Key={"PK": f"BOARD#{board_id}", "SK": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        return BoardMapper.board_to_domain(item)

    def save(self, board: Board) -> None:
        item = BoardMapper.board_to_dynamo(board)
        self._table.put_item(Item=item)

    def delete(self, board_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"BOARD#{board_id}", "SK": "METADATA"}
        )

    def find_boards_for_user(self, user_id: str) -> list[Board]:
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"USER#{user_id}")
            & Key("GSI1SK").begins_with("BOARD#"),
        )
        items = response.get("Items", [])

        boards: list[Board] = []
        for item in items:
            board_id = item["board_id"]
            board = self.find_by_id(board_id)
            if board:
                boards.append(board)

        return boards

    def save_member(self, member: BoardMember) -> None:
        item = BoardMapper.member_to_dynamo(member)
        self._table.put_item(Item=item)

    def remove_member(self, board_id: str, user_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"BOARD#{board_id}", "SK": f"MEMBER#{user_id}"}
        )

    def find_member(self, board_id: str, user_id: str) -> Optional[BoardMember]:
        response = self._table.get_item(
            Key={"PK": f"BOARD#{board_id}", "SK": f"MEMBER#{user_id}"}
        )
        item = response.get("Item")
        if not item:
            return None
        return BoardMapper.member_to_domain(item)

    def find_members(self, board_id: str) -> list[BoardMember]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"BOARD#{board_id}")
            & Key("SK").begins_with("MEMBER#"),
        )
        items = response.get("Items", [])
        return [BoardMapper.member_to_domain(item) for item in items]

    def delete_all_board_data(self, board_id: str) -> None:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"BOARD#{board_id}")
        )
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"BOARD#{board_id}"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
