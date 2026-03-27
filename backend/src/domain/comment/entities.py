from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel


class ProgressComment(BaseModel):
    comment_id: str
    task_id: str
    project_id: str
    author_id: str
    message: str
    created_at: str

    @classmethod
    def create(
        cls,
        comment_id: str,
        task_id: str,
        project_id: str,
        author_id: str,
        message: str,
    ) -> "ProgressComment":
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            comment_id=comment_id,
            task_id=task_id,
            project_id=project_id,
            author_id=author_id,
            message=message,
            created_at=now,
        )

    def to_dict(self) -> dict:
        return {
            "comment_id": self.comment_id,
            "task_id": self.task_id,
            "project_id": self.project_id,
            "author_id": self.author_id,
            "message": self.message,
            "created_at": self.created_at,
        }
