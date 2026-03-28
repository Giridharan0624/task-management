from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.dayoff.entities import DayOffRequest
from domain.dayoff.repository import IDayOffRepository
from domain.project.repository import IProjectRepository
from domain.project.value_objects import ProjectRole
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError, ValidationError


class CreateDayOffRequestUseCase:
    def __init__(
        self,
        dayoff_repo: IDayOffRepository,
        user_repo: IUserRepository,
        project_repo: IProjectRepository,
    ):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo
        self._project_repo = project_repo

    def execute(
        self,
        caller_user_id: str,
        start_date: str,
        end_date: str,
        reason: str,
        admin_id: str,
    ) -> dict:
        if not start_date or not end_date or not reason or not admin_id:
            raise ValidationError("start_date, end_date, reason, and admin_id are required")

        user = self._user_repo.find_by_id(caller_user_id)
        if not user:
            raise NotFoundError("User not found")

        if user.system_role == SystemRole.OWNER:
            raise AuthorizationError("Owner account cannot request day offs")

        admin = self._user_repo.find_by_id(admin_id)
        admin_name = admin.name if admin else None

        # Find team lead from user's projects
        team_lead_id = None
        team_lead_name = None
        projects = self._project_repo.find_projects_for_user(caller_user_id)
        for project in projects:
            members = self._project_repo.find_members(project.project_id)
            for member in members:
                if member.project_role == ProjectRole.TEAM_LEAD and member.user_id != caller_user_id:
                    team_lead_id = member.user_id
                    lead_user = self._user_repo.find_by_id(member.user_id)
                    team_lead_name = lead_user.name if lead_user else None
                    break
            if team_lead_id:
                break

        request_id = str(uuid.uuid4())
        day_off = DayOffRequest.create(
            request_id=request_id,
            user_id=caller_user_id,
            user_name=user.name,
            employee_id=user.employee_id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            admin_id=admin_id,
            admin_name=admin_name,
            team_lead_id=team_lead_id,
            team_lead_name=team_lead_name,
        )
        day_off.status = day_off.compute_status()
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()


class GetMyRequestsUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str) -> list[dict]:
        requests = self._dayoff_repo.find_by_user(caller_user_id)
        return [r.to_dict() for r in requests]


class GetPendingApprovalsUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str) -> list[dict]:
        requests = self._dayoff_repo.find_by_approver(caller_user_id)
        pending = []
        for r in requests:
            if r.status != "PENDING":
                continue
            # Only include if the caller still needs to act
            if r.team_lead_id == caller_user_id and r.team_lead_status == "PENDING":
                pending.append(r.to_dict())
            elif (r.admin_id == caller_user_id or r.forwarded_to == caller_user_id) and r.admin_status == "PENDING":
                pending.append(r.to_dict())
        return pending


class GetAllRequestsUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can view all day-off requests")
        requests = self._dayoff_repo.find_all()
        return [r.to_dict() for r in requests]


class ApproveRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, request_id: str) -> dict:
        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        now = datetime.now(timezone.utc).isoformat()

        if day_off.team_lead_id == caller_user_id:
            day_off.team_lead_status = "APPROVED"
        elif day_off.admin_id == caller_user_id or day_off.forwarded_to == caller_user_id:
            day_off.admin_status = "APPROVED"
        else:
            raise AuthorizationError("You are not an approver for this request")

        day_off.status = day_off.compute_status()
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()


class RejectRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, request_id: str) -> dict:
        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        now = datetime.now(timezone.utc).isoformat()

        if day_off.team_lead_id == caller_user_id:
            day_off.team_lead_status = "REJECTED"
        elif day_off.admin_id == caller_user_id or day_off.forwarded_to == caller_user_id:
            day_off.admin_status = "REJECTED"
        else:
            raise AuthorizationError("You are not an approver for this request")

        day_off.status = day_off.compute_status()
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()


class ForwardRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(
        self,
        caller_user_id: str,
        caller_system_role: str,
        request_id: str,
        forward_to_id: str,
    ) -> dict:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can forward requests")

        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        if not forward_to_id:
            raise ValidationError("forward_to_id is required")

        forward_user = self._user_repo.find_by_id(forward_to_id)
        if not forward_user:
            raise NotFoundError("Forward-to user not found")

        now = datetime.now(timezone.utc).isoformat()
        day_off.forwarded_to = forward_to_id
        day_off.forwarded_to_name = forward_user.name
        day_off.forwarded_by = caller_user_id
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()
