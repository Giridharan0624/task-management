from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.project.entities import Project, ProjectMember
from domain.project.repository import IProjectRepository
from domain.project.value_objects import ProjectRole
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError, ValidationError

_PRIVILEGED_ROLES = (SystemRole.OWNER.value, SystemRole.ADMIN.value)


def _is_project_admin_or_privileged(
    project_repo: IProjectRepository,
    project_id: str,
    caller_user_id: str,
    caller_system_role: str,
) -> bool:
    """Return True if caller is OWNER/ADMIN system role OR a project-level ADMIN."""
    if caller_system_role in _PRIVILEGED_ROLES:
        return True
    member = project_repo.find_member(project_id, caller_user_id)
    return member is not None and member.project_role == ProjectRole.ADMIN


class CreateProjectUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can create projects")

        project_id = str(uuid.uuid4())
        project = Project.create(
            project_id=project_id,
            name=dto["name"],
            created_by=caller_user_id,
            description=dto.get("description"),
        )
        self._project_repo.save(project)

        # Auto-add creator as project ADMIN
        member = ProjectMember.create(
            project_id=project_id,
            user_id=caller_user_id,
            project_role=ProjectRole.ADMIN,
        )
        self._project_repo.save_member(member)

        return project.to_dict()


class GetProjectUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        project_id = dto["project_id"]
        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        caller_member = self._project_repo.find_member(project_id, caller_user_id)
        if not caller_member and caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("You are not a member of this project")

        members = self._project_repo.find_members(project_id)
        return {**project.to_dict(), "members": [m.to_dict() for m in members]}


class ListProjectsForUserUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            projects = self._project_repo.find_all()
        else:
            projects = self._project_repo.find_projects_for_user(caller_user_id)
        return [p.to_dict() for p in projects]


class DeleteProjectUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> None:
        project_id = dto["project_id"]
        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only project admins can delete this project")

        self._project_repo.delete_all_project_data(project_id)


class AddProjectMemberUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        project_id = dto["project_id"]
        target_user_id = dto["user_id"]
        project_role_value = dto.get("project_role", ProjectRole.MEMBER.value)

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only project admins can add members")

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        try:
            project_role = ProjectRole(project_role_value)
        except ValueError:
            raise ValidationError(f"Invalid project role: {project_role_value}")

        member = ProjectMember.create(
            project_id=project_id,
            user_id=target_user_id,
            project_role=project_role,
        )
        self._project_repo.save_member(member)
        return member.to_dict()


class RemoveProjectMemberUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> None:
        project_id = dto["project_id"]
        target_user_id = dto["user_id"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only project admins can remove members")

        self._project_repo.remove_member(project_id, target_user_id)


class UpdateMemberRoleUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        project_id = dto["project_id"]
        target_user_id = dto["user_id"]
        new_role_value = dto["project_role"]

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("Only project admins can update member roles")

        target_member = self._project_repo.find_member(project_id, target_user_id)
        if not target_member:
            raise NotFoundError(f"Member {target_user_id} not found in project {project_id}")

        try:
            new_role = ProjectRole(new_role_value)
        except ValueError:
            raise ValidationError(f"Invalid project role: {new_role_value}")

        updated_member = ProjectMember(
            project_id=target_member.project_id,
            user_id=target_member.user_id,
            project_role=new_role,
            joined_at=target_member.joined_at,
        )
        self._project_repo.save_member(updated_member)
        return updated_member.to_dict()
