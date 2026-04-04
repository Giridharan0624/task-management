from abc import ABC, abstractmethod
from typing import Optional

from contexts.user.domain.entities import User


class IUserRepository(ABC):
    @abstractmethod
    def find_by_id(self, user_id: str) -> Optional[User]:
        ...

    @abstractmethod
    def find_by_email(self, email: str) -> Optional[User]:
        ...

    @abstractmethod
    def save(self, user: User) -> None:
        ...

    @abstractmethod
    def update(self, user: User) -> None:
        ...

    @abstractmethod
    def find_all(self) -> list[User]:
        ...

    @abstractmethod
    def find_by_employee_id(self, employee_id: str) -> Optional[User]:
        ...

    @abstractmethod
    def get_next_employee_number(self) -> int:
        ...

    @abstractmethod
    def delete(self, user_id: str) -> None:
        ...
