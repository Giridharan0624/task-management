from __future__ import annotations

from datetime import datetime, timezone

from domain.attendance.entities import Attendance
from domain.attendance.repository import IAttendanceRepository
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole
from shared.errors import AuthorizationError, NotFoundError, ValidationError


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


class SignInUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository, user_repo: IUserRepository):
        self._attendance_repo = attendance_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> dict:
        date = _today()
        existing = self._attendance_repo.find_by_user_and_date(caller_user_id, date)

        if existing and existing.is_signed_in:
            raise ValidationError("You are already signed in")

        user = self._user_repo.find_by_id(caller_user_id)
        if not user:
            raise NotFoundError("User not found")

        if existing:
            # Add a new session to existing attendance
            updated = existing.sign_in()
            self._attendance_repo.save(updated)
            return updated.to_dict()
        else:
            # First session of the day
            attendance = Attendance.create(
                user_id=caller_user_id,
                user_name=user.name,
                user_email=user.email,
                system_role=caller_system_role,
            )
            self._attendance_repo.save(attendance)
            return attendance.to_dict()


class SignOutUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str) -> dict:
        date = _today()
        attendance = self._attendance_repo.find_by_user_and_date(caller_user_id, date)
        if not attendance:
            raise ValidationError("You are not signed in today")
        if not attendance.is_signed_in:
            raise ValidationError("You are not currently signed in")

        updated = attendance.sign_out()
        self._attendance_repo.save(updated)
        return updated.to_dict()


class GetMyAttendanceUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str) -> dict | None:
        date = _today()
        attendance = self._attendance_repo.find_by_user_and_date(caller_user_id, date)
        if not attendance:
            return None
        return attendance.to_dict()


class ListTodayAttendanceUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in (SystemRole.OWNER.value, SystemRole.ADMIN.value):
            raise AuthorizationError("Only owners and admins can view team attendance")

        date = _today()
        records = self._attendance_repo.find_all_by_date(date)

        if caller_system_role == SystemRole.OWNER.value:
            return [r.to_dict() for r in records]

        return [
            r.to_dict()
            for r in records
            if r.user_id == caller_user_id or r.system_role == SystemRole.MEMBER.value
        ]
