from typing import Optional

from boto3.dynamodb.conditions import Key

from contexts.comment.domain.entities import ProgressComment
from contexts.comment.domain.repository import ICommentRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import get_current_org_id
from shared_kernel import tenant_keys
from contexts.comment.infrastructure.mapper import CommentMapper


class CommentDynamoRepository(ICommentRepository):
    def __init__(self, org_id: Optional[str] = None):
        self._table = get_table()
        self._org_id = org_id if org_id is not None else get_current_org_id()

    def save(self, comment: ProgressComment) -> None:
        self._table.put_item(Item=CommentMapper.to_dynamo(comment))
        self._table.put_item(Item=CommentMapper.to_dynamo_v2(comment, self._org_id))

    def find_by_task(self, task_id: str) -> list[ProgressComment]:
        task_pk = tenant_keys.comment_pk(self._org_id, task_id)
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(task_pk)
            & Key("SK").begins_with("COMMENT#"),
        )
        items = response.get("Items", [])
        comments = [CommentMapper.to_domain(item) for item in items]

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(task_pk)
                & Key("SK").begins_with("COMMENT#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            comments.extend(CommentMapper.to_domain(item) for item in response.get("Items", []))

        return comments

    def delete_all_by_task(self, task_id: str) -> None:
        legacy_pk = f"TASK#{task_id}"
        v2_pk = tenant_keys.comment_pk(self._org_id, task_id)

        all_items: list[dict] = []
        for pk in (legacy_pk, v2_pk):
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(pk)
                & Key("SK").begins_with("COMMENT#"),
            )
            all_items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self._table.query(
                    KeyConditionExpression=Key("PK").eq(pk)
                    & Key("SK").begins_with("COMMENT#"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                all_items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in all_items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
