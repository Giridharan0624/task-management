from boto3.dynamodb.conditions import Key

from contexts.comment.domain.entities import ProgressComment
from contexts.comment.domain.repository import ICommentRepository
from shared_kernel.dynamo_client import get_table
from contexts.comment.infrastructure.mapper import CommentMapper


class CommentDynamoRepository(ICommentRepository):
    def __init__(self):
        self._table = get_table()

    def save(self, comment: ProgressComment) -> None:
        item = CommentMapper.to_dynamo(comment)
        self._table.put_item(Item=item)

    def find_by_task(self, task_id: str) -> list[ProgressComment]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"TASK#{task_id}")
            & Key("SK").begins_with("COMMENT#"),
        )
        items = response.get("Items", [])
        comments = [CommentMapper.to_domain(item) for item in items]

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"TASK#{task_id}")
                & Key("SK").begins_with("COMMENT#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            comments.extend(CommentMapper.to_domain(item) for item in response.get("Items", []))

        return comments

    def delete_all_by_task(self, task_id: str) -> None:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"TASK#{task_id}")
            & Key("SK").begins_with("COMMENT#"),
        )
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"TASK#{task_id}")
                & Key("SK").begins_with("COMMENT#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
