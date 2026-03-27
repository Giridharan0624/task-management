from abc import ABC, abstractmethod
from typing import Optional

from domain.project.entities import Project, ProjectMember


class IProjectRepository(ABC):
    @abstractmethod
    def find_by_id(self, project_id: str) -> Optional[Project]:
        ...

    @abstractmethod
    def save(self, project: Project) -> None:
        ...

    @abstractmethod
    def delete(self, project_id: str) -> None:
        ...

    @abstractmethod
    def find_projects_for_user(self, user_id: str) -> list[Project]:
        ...

    @abstractmethod
    def save_member(self, member: ProjectMember) -> None:
        ...

    @abstractmethod
    def remove_member(self, project_id: str, user_id: str) -> None:
        ...

    @abstractmethod
    def find_member(self, project_id: str, user_id: str) -> Optional[ProjectMember]:
        ...

    @abstractmethod
    def find_members(self, project_id: str) -> list[ProjectMember]:
        ...

    @abstractmethod
    def find_all(self) -> list[Project]:
        ...

    @abstractmethod
    def delete_all_project_data(self, project_id: str) -> None:
        ...
