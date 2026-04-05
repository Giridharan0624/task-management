from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from contexts.attendance.domain.entities import Attendance
from contexts.attendance.domain.repository import IAttendanceRepository
from contexts.task.domain.repository import ITaskRepository
from contexts.user.domain.repository import IUserRepository
from contexts.user.domain.value_objects import SystemRole, PRIVILEGED_ROLES
from shared_kernel.errors import AuthorizationError, NotFoundError, ValidationError

IST = timezone(timedelta(hours=5, minutes=30))


def _today() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _yesterday() -> str:
    return (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")


class SignInUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository, user_repo: IUserRepository, task_repo: ITaskRepository = None):
        self._attendance_repo = attendance_repo
        self._user_repo = user_repo
        self._task_repo = task_repo

    def _auto_move_task_to_in_progress(self, task_id: str) -> None:
        """Move task to IN_PROGRESS if it's currently TODO."""
        if not self._task_repo or not task_id:
            return
        task = self._task_repo.find_by_id(task_id)
        if task and str(task.status) == "TODO":
            from datetime import datetime, timezone
            from contexts.task.domain.entities import Task
            updated = Task(
                **{**task.model_dump(), "status": "IN_PROGRESS", "updated_at": datetime.now(timezone.utc).isoformat()}
            )
            self._task_repo.update(updated)

    def execute(
        self,
        caller_user_id: str,
        caller_system_role: str,
        task_id: Optional[str] = None,
        project_id: Optional[str] = None,
        task_title: Optional[str] = None,
        project_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> dict:
        date = _today()
        existing = self._attendance_repo.find_by_user_and_date(caller_user_id, date)

        user = self._user_repo.find_by_id(caller_user_id)
        if not user:
            raise NotFoundError("User not found")

        # Auto-close yesterday's active session if date has rolled over
        if not existing or not existing.is_signed_in:
            yesterday_record = self._attendance_repo.find_by_user_and_date(caller_user_id, _yesterday())
            if yesterday_record and yesterday_record.is_signed_in:
                closed = yesterday_record.sign_out()
                self._attendance_repo.save(closed)

        if existing and existing.is_signed_in:
            if task_id:
                stopped = existing.sign_out()
                switched = stopped.sign_in(
                    task_id=task_id, project_id=project_id,
                    task_title=task_title, project_name=project_name,
                    description=description,
                )
                self._attendance_repo.save(switched)
                self._auto_move_task_to_in_progress(task_id)
                return switched.to_dict()
            else:
                raise ValidationError("You are already tracking time. Select a task to switch to, or stop the current timer first.")

        if existing:
            updated = existing.sign_in(
                task_id=task_id, project_id=project_id,
                task_title=task_title, project_name=project_name,
                description=description,
            )
            self._attendance_repo.save(updated)
            self._auto_move_task_to_in_progress(task_id)
            return updated.to_dict()
        else:
            attendance = Attendance.create(
                user_id=caller_user_id,
                user_name=user.name, user_email=user.email,
                system_role=caller_system_role,
                task_id=task_id, project_id=project_id,
                task_title=task_title, project_name=project_name,
                description=description,
            )
            self._attendance_repo.save(attendance)
            self._auto_move_task_to_in_progress(task_id)
            return attendance.to_dict()


class SignOutUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str) -> dict:
        date = _today()
        attendance = self._attendance_repo.find_by_user_and_date(caller_user_id, date)

        # If no active session today, check yesterday (cross-midnight work)
        if not attendance or not attendance.is_signed_in:
            yesterday_record = self._attendance_repo.find_by_user_and_date(caller_user_id, _yesterday())
            if yesterday_record and yesterday_record.is_signed_in:
                attendance = yesterday_record
            elif not attendance:
                raise ValidationError("You haven't started tracking today. Start the timer in the Desktop App first.")
            else:
                raise ValidationError("Your timer is not running. Start tracking in the Desktop App first.")

        updated = attendance.sign_out()
        self._attendance_repo.save(updated)
        return updated.to_dict()


class GetMyAttendanceUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str) -> dict | None:
        date = _today()
        attendance = self._attendance_repo.find_by_user_and_date(caller_user_id, date)
        if attendance:
            return attendance.to_dict()

        # Check yesterday for active session (user still signed in past midnight)
        yesterday_record = self._attendance_repo.find_by_user_and_date(caller_user_id, _yesterday())
        if yesterday_record and yesterday_record.is_signed_in:
            return yesterday_record.to_dict()

        return None


class ListTodayAttendanceUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str, caller_system_role: str) -> list[dict]:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("You don't have permission to view team attendance.")

        date = _today()
        records = self._attendance_repo.find_all_by_date(date)

        # Include yesterday's records that still have active sessions (cross-midnight)
        today_user_ids = {r.user_id for r in records}
        yesterday_records = self._attendance_repo.find_all_by_date(_yesterday())
        for r in yesterday_records:
            if r.is_signed_in and r.user_id not in today_user_ids:
                records.append(r)

        return [r.to_dict() for r in records]


class GetAttendanceReportUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str, caller_system_role: str, start_date: str, end_date: str) -> list[dict]:
        records = self._attendance_repo.find_all_by_date_range(start_date, end_date)

        if caller_system_role in PRIVILEGED_ROLES:
            return [r.to_dict() for r in records]

        # MEMBER sees only their own records
        return [r.to_dict() for r in records if r.user_id == caller_user_id]
