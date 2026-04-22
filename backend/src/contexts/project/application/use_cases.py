from __future__ import annotations

import uuid
from datetime import datetime, timezone

from contexts.project.domain.entities import Project, ProjectMember
from contexts.project.domain.repository import IProjectRepository
from contexts.user.domain.repository import IUserRepository
from contexts.org.domain import permissions as P
from contexts.org.domain.default_project_roles import (
    PROJECT_MANAGER_ROLE_ID,
    PROJECT_MEMBER_ROLE_ID,
    PROJECT_MANAGE_ROLE_IDS,
    TEAM_LEAD_ROLE_ID,
    normalize_project_role_id,
)
from contexts.user.domain.value_objects import SystemRole
from shared_kernel.permissions import role_has
from contexts.task.domain.repository import ITaskRepository
from contexts.task.domain.value_objects import STATUS_PROGRESS, DOMAIN_STATUSES
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError


def _is_project_admin_or_privileged(
    project_repo: IProjectRepository,
    project_id: str,
    caller_user_id: str,
    caller_system_role: str,
) -> bool:
    """Return True if caller has project-edit power via system role OR is a
    privileged member on this specific project (default project_admin /
    project_manager / team_lead, or any custom project role whose ID
    matches one of the seeded manage roles).

    Pragmatism: we gate on the role_id string for the seeded defaults.
    Tenant-defined custom project roles fall through to false here and
    would need the frontend to call the system permission resolver if
    per-tenant project-admin roles are needed. Good enough for v1 — the
    default roles cover the common case.
    """
    if role_has(caller_system_role, P.PROJECT_EDIT):
        return True
    member = project_repo.find_member(project_id, caller_user_id)
    if member is None:
        return False
    return member.project_role_id in PROJECT_MANAGE_ROLE_IDS


class CreateProjectUseCase:
    def __init__(
        self,
        project_repo: IProjectRepository,
        user_repo: IUserRepository,
        org_repo=None,
    ):
        self._project_repo = project_repo
        self._user_repo = user_repo
        self._org_repo = org_repo  # optional — used for plan-limit check

    def execute(
        self,
        dto: dict,
        caller_user_id: str,
        caller_system_role: str,
        caller_org_id: str = "",
    ) -> dict:
        if not role_has(caller_system_role, P.PROJECT_CREATE):
            raise AuthorizationError("You don't have permission to create projects.")

        # Plan limit: refuse if max_projects would be exceeded
        if self._org_repo is not None and caller_org_id:
            plan = self._org_repo.get_plan(caller_org_id)
            if plan and plan.max_projects is not None:
                existing = len(self._project_repo.find_all())
                if existing >= plan.max_projects:
                    raise ValidationError(
                        f"Your {plan.tier.value} plan is limited to "
                        f"{plan.max_projects} projects. Upgrade to add more."
                    )

        team_lead_id = dto.get("team_lead_id")
        project_manager_id = dto.get("project_manager_id")
        member_ids = dto.get("member_ids", [])

        # Validate team lead exists
        if team_lead_id:
            tl_user = self._user_repo.find_by_id(team_lead_id)
            if not tl_user:
                raise NotFoundError(f"Team lead user {team_lead_id} not found")

        # Validate project manager exists
        if project_manager_id:
            pm_user = self._user_repo.find_by_id(project_manager_id)
            if not pm_user:
                raise NotFoundError(f"Project manager user {project_manager_id} not found")

        # Validate all members exist
        for uid in member_ids:
            if not self._user_repo.find_by_id(uid):
                raise NotFoundError(f"User {uid} not found")

        project_id = str(uuid.uuid4())
        project = Project.create(
            project_id=project_id,
            name=dto["name"],
            created_by=caller_user_id,
            description=dto.get("description"),
            domain=dto.get("domain", "DEVELOPMENT"),
        )
        self._project_repo.save(project)

        # Add team lead
        if team_lead_id:
            tl_member = ProjectMember.create(
                project_id=project_id,
                user_id=team_lead_id,
                project_role_id=TEAM_LEAD_ROLE_ID,
            )
            self._project_repo.save_member(tl_member)

        # Add project manager
        if project_manager_id:
            pm_member = ProjectMember.create(
                project_id=project_id,
                user_id=project_manager_id,
                project_role_id=PROJECT_MANAGER_ROLE_ID,
            )
            self._project_repo.save_member(pm_member)

        # Add members
        for uid in member_ids:
            if uid in (team_lead_id, project_manager_id):
                continue
            m = ProjectMember.create(
                project_id=project_id,
                user_id=uid,
                project_role_id=PROJECT_MEMBER_ROLE_ID,
            )
            self._project_repo.save_member(m)

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
        if not caller_member and not role_has(caller_system_role, P.PROJECT_LIST_ALL):
            raise AuthorizationError("You don't have access to this project.")

        members = self._project_repo.find_members(project_id)
        enriched_members = []
        for m in members:
            member_dict = m.to_dict()
            user = self._user_repo.find_by_id(m.user_id)
            if user:
                member_dict["user"] = user.to_dict()
            if m.added_by:
                adder = self._user_repo.find_by_id(m.added_by)
                member_dict["added_by_name"] = adder.name or adder.email if adder else None
            enriched_members.append(member_dict)
        return {**project.to_dict(), "members": enriched_members}


class ListProjectsForUserUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository, task_repo=None):
        self._project_repo = project_repo
        self._user_repo = user_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if role_has(caller_system_role, P.PROJECT_LIST_ALL):
            projects = self._project_repo.find_all()
        else:
            projects = self._project_repo.find_projects_for_user(caller_user_id)
        result = []
        for p in projects:
            d = p.to_dict()
            members = self._project_repo.find_members(p.project_id)
            d["member_count"] = len(members)
            # Always emit numeric counts + percent, even when we have no task
            # repo handy. Keeps the frontend type-safe — consumers never have
            # to guard against undefined/NaN on these keys.
            if self._task_repo:
                tasks = self._task_repo.find_by_project(p.project_id)
                total = len(tasks)
                done = sum(1 for t in tasks if str(t.status) == "DONE")
                d["task_count"] = total
                d["done_count"] = done
                d["completion_percent"] = (
                    round(sum(STATUS_PROGRESS.get(str(t.status), 0) for t in tasks) / total)
                    if total > 0
                    else 0
                )
            else:
                d["task_count"] = 0
                d["done_count"] = 0
                d["completion_percent"] = 0
            result.append(d)
        return result


class UpdateProjectUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository, task_repo: ITaskRepository = None):
        self._project_repo = project_repo
        self._user_repo = user_repo
        self._task_repo = task_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        project_id = dto["project_id"]
        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("You don't have permission to update this project.")

        now = datetime.now(timezone.utc).isoformat()
        overrides: dict = {"updated_at": now}
        if "name" in dto:
            overrides["name"] = dto["name"]
        if "description" in dto:
            overrides["description"] = dto["description"]
        if "estimated_hours" in dto:
            overrides["estimated_hours"] = dto["estimated_hours"]

        # If domain changed, migrate orphaned task statuses
        new_domain = dto.get("domain")
        if new_domain and new_domain != project.domain and self._task_repo:
            overrides["domain"] = new_domain
            new_statuses = DOMAIN_STATUSES.get(new_domain, DOMAIN_STATUSES["DEVELOPMENT"])
            tasks = self._task_repo.find_by_project(project_id)
            for task in tasks:
                if str(task.status) not in new_statuses and str(task.status) != "DONE":
                    # Reset to TODO if current status doesn't exist in the new domain
                    updated_task = task.model_copy(update={"status": "TODO", "updated_at": now})
                    self._task_repo.update(updated_task)
                elif str(task.status) == "DONE":
                    pass  # DONE exists in all domains, keep as-is
        elif new_domain:
            overrides["domain"] = new_domain

        updated = project.model_copy(update=overrides)
        self._project_repo.save(updated)
        return updated.to_dict()


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
            raise AuthorizationError("You don't have permission to delete this project.")

        self._project_repo.delete_all_project_data(project_id)


class AddProjectMemberUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        project_id = dto["project_id"]
        target_user_id = dto["user_id"]
        # Accept either the new `project_role_id` field (canonical) or
        # the legacy `project_role` field. normalize_project_role_id
        # handles enum-value → role_id translation both for legacy
        # clients and for anyone writing custom role IDs.
        raw_role = (
            dto.get("project_role_id")
            or dto.get("project_role")
            or PROJECT_MEMBER_ROLE_ID
        )
        project_role_id = normalize_project_role_id(raw_role)

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("You don't have permission to add members to this project.")

        target_user = self._user_repo.find_by_id(target_user_id)
        if not target_user:
            raise NotFoundError(f"User {target_user_id} not found")

        # Existing members — used for both the duplicate-guard and the
        # single-Team-Lead check. One query covers both.
        existing_members = self._project_repo.find_members(project_id)
        for m in existing_members:
            if m.user_id == target_user_id:
                raise ValidationError(
                    f"{target_user.name or target_user.email} is already a member of this project."
                )

        # Only one Team Lead per project. Matched on role_id string so
        # this survives the enum removal.
        if project_role_id == TEAM_LEAD_ROLE_ID:
            for m in existing_members:
                if m.project_role_id == TEAM_LEAD_ROLE_ID:
                    raise ValidationError("This project already has a Team Lead. Please remove the current one before assigning a new one.")

        member = ProjectMember.create(
            project_id=project_id,
            user_id=target_user_id,
            project_role_id=project_role_id,
            added_by=caller_user_id,
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
            raise AuthorizationError("You don't have permission to remove members from this project.")

        self._project_repo.remove_member(project_id, target_user_id)


class UpdateMemberRoleUseCase:
    def __init__(self, project_repo: IProjectRepository, user_repo: IUserRepository):
        self._project_repo = project_repo
        self._user_repo = user_repo

    def execute(self, dto: dict, caller_user_id: str, caller_system_role: str) -> dict:
        project_id = dto["project_id"]
        target_user_id = dto["user_id"]
        raw_role = dto.get("project_role_id") or dto.get("project_role")
        if not raw_role:
            raise ValidationError("project_role_id is required.")
        new_role_id = normalize_project_role_id(raw_role)

        project = self._project_repo.find_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if not _is_project_admin_or_privileged(self._project_repo, project_id, caller_user_id, caller_system_role):
            raise AuthorizationError("You don't have permission to change member roles in this project.")

        target_member = self._project_repo.find_member(project_id, target_user_id)
        if not target_member:
            raise NotFoundError(f"Member {target_user_id} not found in project {project_id}")

        # Only one Team Lead per project. Match on role_id string.
        if new_role_id == TEAM_LEAD_ROLE_ID:
            existing_members = self._project_repo.find_members(project_id)
            for m in existing_members:
                if (
                    m.project_role_id == TEAM_LEAD_ROLE_ID
                    and m.user_id != target_user_id
                ):
                    raise ValidationError("This project already has a Team Lead. Please remove the current one before assigning a new one.")

        updated_member = ProjectMember(
            project_id=target_member.project_id,
            user_id=target_member.user_id,
            project_role_id=new_role_id,
            added_by=target_member.added_by,
            joined_at=target_member.joined_at,
        )
        self._project_repo.save_member(updated_member)
        return updated_member.to_dict()
