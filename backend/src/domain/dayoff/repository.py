from abc import ABC, abstractmethod
from typing import Optional

from domain.dayoff.entities import DayOffRequest


class IDayOffRepository(ABC):
    @abstractmethod
    def save(self, request: DayOffRequest) -> None: ...

    @abstractmethod
    def find_by_id(self, request_id: str) -> Optional[DayOffRequest]: ...

    @abstractmethod
    def find_by_user(self, user_id: str) -> list[DayOffRequest]: ...

    @abstractmethod
    def find_by_approver(self, approver_id: str) -> list[DayOffRequest]: ...

    @abstractmethod
    def find_all(self) -> list[DayOffRequest]: ...
