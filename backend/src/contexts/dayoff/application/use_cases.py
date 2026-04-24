from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from contexts.dayoff.domain.entities import DayOffRequest
from contexts.dayoff.domain.repository import IDayOffRepository
from contexts.org.domain import permissions as P
from contexts.user.domain.repository import IUserRepository
from contexts.user.domain.value_objects import SystemRole
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError
from shared_kernel.permissions import role_has

# Upper bound on a single day-off request. Longer leave should be broken
# into smaller requests so admins review them in review-friendly chunks.
MAX_DAYOFF_SPAN_DAYS = 365


def _parse_date_only(value: str, field_name: str) -> date:
    """Accept "YYYY-MM-DD" or ISO datetime, return the date portion.

    Raises ValidationError with a user-facing message on unparsable input.
    """
    if not value or not isinstance(value, str):
        raise ValidationError(f"{field_name} is required.")
    # Prefer the date-only slice so "2026-04-21T10:30" works.
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        raise ValidationError(f"{field_name} must be a valid date.")


class CreateDayOffRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, start_date: str, end_date: str, reason: str) -> dict:
        if not start_date or not end_date or not reason:
            raise ValidationError("Please fill in the start date, end date, and reason for your day-off request.")

        # Date sanity — done before any DynamoDB calls so malformed input
        # bails fast and with a clear message.
        start = _parse_date_only(start_date, "Start date")
        end = _parse_date_only(end_date, "End date")
        today = date.today()
        if start < today:
            raise ValidationError("Day-off start date cannot be in the past.")
        if end < start:
            raise ValidationError("End date must be on or after start date.")
        span = (end - start).days + 1
        if span > MAX_DAYOFF_SPAN_DAYS:
            raise ValidationError(
                f"Day-off requests are capped at {MAX_DAYOFF_SPAN_DAYS} days. "
                "Please split longer leave into multiple requests."
            )

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
            # Anyone who can approve a day-off is a valid auto-approver.
            if role_has(u.system_role, P.DAYOFF_APPROVE):
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
        if not role_has(caller_system_role, P.DAYOFF_APPROVE):
            return []
        requests = self._dayoff_repo.find_all()
        # Show pending requests, but exclude caller's own requests (can't self-approve)
        return [r.to_dict() for r in requests
                if r.status == "PENDING" and r.admin_status == "PENDING" and r.user_id != caller_user_id]


class GetAllRequestsUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository):
        self._dayoff_repo = dayoff_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if not role_has(caller_system_role, P.DAYOFF_LIST_ALL):
            raise AuthorizationError("You don't have permission to view all day-off requests.")
        requests = self._dayoff_repo.find_all()
        return [r.to_dict() for r in requests]


class ApproveRequestUseCase:
    def __init__(self, dayoff_repo: IDayOffRepository, user_repo: IUserRepository):
        self._dayoff_repo = dayoff_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str, request_id: str) -> dict:
        if not role_has(caller_system_role, P.DAYOFF_APPROVE):
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
        if not role_has(caller_system_role, P.DAYOFF_REJECT):
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
    """Allow the requesting user to cancel their own pending day-off.

    Once a request has been approved or rejected it can't be cancelled —
    the requester must talk to an admin to revert it. This prevents a
    member silently withdrawing leave that an admin already counted on.
    """
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
        if day_off.status == "APPROVED":
            raise ValidationError(
                "This request was already approved. Ask an admin to cancel it for you."
            )
        if day_off.status == "REJECTED":
            raise ValidationError("A rejected request cannot be cancelled.")

        now = datetime.now(timezone.utc).isoformat()
        day_off.status = "CANCELLED"
        day_off.admin_status = "CANCELLED"
        day_off.updated_at = now
        self._dayoff_repo.save(day_off)
        return day_off.to_dict()
