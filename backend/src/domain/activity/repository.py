from abc import ABC, abstractmethod
from typing import Optional
from domain.activity.entities import UserActivity, DailySummary


class IActivityRepository(ABC):
    @abstractmethod
    def find_by_user_and_date(self, user_id: str, date: str) -> Optional[UserActivity]:
        ...

    @abstractmethod
    def save(self, activity: UserActivity) -> None:
        ...

    @abstractmethod
    def find_all_by_date(self, date: str) -> list[UserActivity]:
        ...

    @abstractmethod
    def find_all_by_date_range(self, start_date: str, end_date: str) -> list[UserActivity]:
        ...

    @abstractmethod
    def save_summary(self, summary: DailySummary) -> None:
        ...

    @abstractmethod
    def find_summary(self, user_id: str, date: str) -> Optional[DailySummary]:
        ...
