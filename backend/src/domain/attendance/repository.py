from abc import ABC, abstractmethod
from typing import Optional

from domain.attendance.entities import Attendance


class IAttendanceRepository(ABC):
    @abstractmethod
    def find_by_user_and_date(self, user_id: str, date: str) -> Optional[Attendance]:
        ...

    @abstractmethod
    def save(self, attendance: Attendance) -> None:
        ...

    @abstractmethod
    def find_all_by_date(self, date: str) -> list[Attendance]:
        ...

    @abstractmethod
    def find_all_by_date_range(self, start_date: str, end_date: str) -> list[Attendance]:
        ...
