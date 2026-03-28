from __future__ import annotations

import uuid
from datetime import datetime, timezone

from domain.dayoff.entities import DayOffRequest
from domain.dayoff.repository import IDayOffRepository
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole, TOP_TIER_VALUES, PRIVILEGED_ROLES
from shared.errors import AuthorizationError, NotFoundError, ValidationError

_APPROVER_ROLES = (SystemRole.CEO, SystemRole.MD)


class CreateDayOffRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, start_date: str, end_date: str, reason: str) -> dict:
        if not start_date or not end_date or not reason:
            raise ValidationError("start_date, end_date, and reason are required")

        user = self._user_repo.find_by_id(caller_user_id)
        if not user:
            raise NotFoundError("User not found")

        if user.system_role.value in TOP_TIER_VALUES:
            raise AuthorizationError("Management accounts (OWNER/CEO/MD) cannot request day offs")

        # Auto-find CEO or MD as approver
        all_users = self._user_repo.find_all()
        approver = None
        for u in all_users:
            if u.system_role in _APPROVER_ROLES:
                approver = u
                break

        if not approver:
            raise ValidationError("No CEO or MD found in the system to approve day-off requests")

        request_id = str(uuid.uuid4())
        day_off = DayOffRequest.create(
            request_id=request_id,
            user_id=caller_user_id,
            user_name=user.name,
            employee_id=user.employee_id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            admin_id=approver.user_id,
            admin_name=approver.name,
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

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in (SystemRole.CEO.value, SystemRole.MD.value):
            return []
        requests = self._dayoff_repo.find_all()
        return [r.to_dict() for r in requests if r.status == "PENDING" and r.admin_status == "PENDING"]


class GetAllRequestsUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only owners, CEO, MD, and admins can view all day-off requests")
        requests = self._dayoff_repo.find_all()
        return [r.to_dict() for r in requests]


class ApproveRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str, request_id: str) -> dict:
        if caller_system_role not in (SystemRole.CEO.value, SystemRole.MD.value):
            raise AuthorizationError("Only CEO and MD can approve day-off requests")

        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        caller = self._user_repo.find_by_id(caller_user_id)
        caller_name = caller.name if caller else caller_user_id
        now = datetime.now(timezone.utc).isoformat()

        day_off.admin_status = "APPROVED"
        day_off.admin_name = f"{caller_name} (approved)"
        day_off.admin_id = caller_user_id
        day_off.status = "APPROVED"
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()


class RejectRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str, request_id: str) -> dict:
        if caller_system_role not in (SystemRole.CEO.value, SystemRole.MD.value):
            raise AuthorizationError("Only CEO and MD can reject day-off requests")

        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        caller = self._user_repo.find_by_id(caller_user_id)
        caller_name = caller.name if caller else caller_user_id
        now = datetime.now(timezone.utc).isoformat()

        day_off.admin_status = "REJECTED"
        day_off.admin_name = f"{caller_name} (rejected)"
        day_off.admin_id = caller_user_id
        day_off.status = "REJECTED"
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()
