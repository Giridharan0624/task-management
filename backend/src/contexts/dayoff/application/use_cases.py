from __future__ import annotations

import uuid
from datetime import datetime, timezone

from contexts.dayoff.domain.entities import DayOffRequest
from contexts.dayoff.domain.repository import IDayOffRepository
from contexts.user.domain.repository import IUserRepository
from contexts.user.domain.value_objects import SystemRole, PRIVILEGED_ROLES
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError


class CreateDayOffRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, start_date: str, end_date: str, reason: str) -> dict:
        if not start_date or not end_date or not reason:
            raise ValidationError("Please fill in the start date, end date, and reason for your day-off request.")

        user = self._user_repo.find_by_id(caller_user_id)
        if not user:
            raise NotFoundError("User not found")

        if user.system_role == SystemRole.OWNER:
            raise AuthorizationError("The Owner account cannot request day-offs.")

        # Auto-find an approver (any ADMIN or OWNER, but not the requester)
        all_users = self._user_repo.find_all()
        approver = None
        for u in all_users:
            if u.user_id == caller_user_id:
                continue
            if u.system_role.value in PRIVILEGED_ROLES:
                approver = u
                break

        if not approver:
            raise ValidationError("No one is available to approve your request. Please contact your administrator.")

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
        if caller_system_role not in PRIVILEGED_ROLES:
            return []
        requests = self._dayoff_repo.find_all()
        # Show pending requests, but exclude caller's own requests (can't self-approve)
        return [r.to_dict() for r in requests
                if r.status == "PENDING" and r.admin_status == "PENDING" and r.user_id != caller_user_id]


class GetAllRequestsUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("You don't have permission to view all day-off requests.")
        requests = self._dayoff_repo.find_all()
        return [r.to_dict() for r in requests]


class ApproveRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str, request_id: str) -> dict:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("You don't have permission to approve day-off requests.")

        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        if day_off.user_id == caller_user_id:
            raise AuthorizationError("You cannot approve your own day-off request. Another admin must approve it.")

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
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("You don't have permission to reject day-off requests.")

        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        if day_off.user_id == caller_user_id:
            raise AuthorizationError("You cannot reject your own day-off request.")

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


class CancelRequestUseCase:
    """Allow the requesting user to cancel their own day-off (pending or approved)."""
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, request_id: str) -> dict:
        day_off = self._dayoff_repo.find_by_id(request_id)
        if not day_off:
            raise NotFoundError("Day-off request not found")

        if day_off.user_id != caller_user_id:
            raise AuthorizationError("You can only cancel your own day-off requests.")

        if day_off.status == "CANCELLED":
            raise ValidationError("This day-off request has already been cancelled.")

        now = datetime.now(timezone.utc).isoformat()
        day_off.status = "CANCELLED"
        day_off.admin_status = "CANCELLED"
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()
