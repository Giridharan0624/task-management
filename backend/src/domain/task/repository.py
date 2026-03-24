from abc import ABC, abstractmethod
from typing import Optional

from domain.task.entities import Task


class ITaskRepository(ABC):
    @abstractmethod
    def find_by_id(self, task_id: str) -> Optional[Task]:
        ...

    @abstractmethod
    def find_by_board(self, board_id: str) -> list[Task]:
        ...

    @abstractmethod
    def save(self, task: Task) -> None:
        ...

    @abstractmethod
    def update(self, task: Task) -> None:
        ...

    @abstractmethod
    def delete(self, task_id: str, board_id: str) -> None:
        ...

    @abstractmethod
    def delete_all_by_board(self, board_id: str) -> None:
        ...
