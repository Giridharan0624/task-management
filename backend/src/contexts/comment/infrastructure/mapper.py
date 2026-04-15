from contexts.comment.domain.entities import ProgressComment
from shared_kernel import tenant_keys


class CommentMapper:
    @staticmethod
    def to_domain(item: dict) -> ProgressComment:
        return ProgressComment(
            comment_id=item["comment_id"],
            task_id=item["task_id"],
            project_id=item["project_id"],
            author_id=item["author_id"],
            message=item["message"],
            created_at=item["created_at"],
        )

    @staticmethod
    def to_dynamo(comment: ProgressComment, org_id: str) -> dict:
        return {
            "PK": tenant_keys.comment_pk(org_id, comment.task_id),
            "SK": tenant_keys.comment_sk(comment.created_at, comment.comment_id),
            "org_id": org_id,
            "comment_id": comment.comment_id,
            "task_id": comment.task_id,
            "project_id": comment.project_id,
            "author_id": comment.author_id,
            "message": comment.message,
            "created_at": comment.created_at,
        }
