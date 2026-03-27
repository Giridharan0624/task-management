from abc import ABC, abstractmethod

from domain.comment.entities import ProgressComment


class ICommentRepository(ABC):
    @abstractmethod
    def save(self, comment: ProgressComment) -> None:
        ...

    @abstractmethod
    def find_by_task(self, task_id: str) -> list[ProgressComment]:
        ...

    @abstractmethod
    def delete_all_by_task(self, task_id: str) -> None:
        ...
