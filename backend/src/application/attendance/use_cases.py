from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from domain.attendance.entities import Attendance
from domain.attendance.repository import IAttendanceRepository
from domain.task.repository import ITaskRepository
from domain.task.value_objects import TaskStatus
from domain.user.repository import IUserRepository
from domain.user.value_objects import SystemRole, TOP_TIER_VALUES, PRIVILEGED_ROLES
from shared.errors import AuthorizationError, NotFoundError, ValidationError


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


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
        if task and task.status == TaskStatus.TODO:
            from datetime import datetime, timezone
            from domain.task.entities import Task
            updated = Task(
                **{**task.model_dump(), "status": TaskStatus.IN_PROGRESS, "updated_at": datetime.now(timezone.utc).isoformat()}
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
                raise ValidationError("You are already signed in. Provide a task to switch.")

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
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only owners, CEO, MD, and admins can view team attendance")

        date = _today()
        records = self._attendance_repo.find_all_by_date(date)

        if caller_system_role in TOP_TIER_VALUES:
            return [r.to_dict() for r in records]

        # Admin sees all except top-tier
        return [
            r.to_dict()
            for r in records
            if r.system_role not in TOP_TIER_VALUES
        ]


class GetAttendanceReportUseCase:
    def __init__(self, attendance_repo: IAttendanceRepository):
        self._attendance_repo = attendance_repo

    def execute(self, caller_user_id: str, caller_system_role: str, start_date: str, end_date: str) -> list[dict]:
        records = self._attendance_repo.find_all_by_date_range(start_date, end_date)

        if caller_system_role in TOP_TIER_VALUES:
            return [r.to_dict() for r in records]

        if caller_system_role == SystemRole.ADMIN.value:
            return [
                r.to_dict()
                for r in records
                if r.system_role not in TOP_TIER_VALUES
            ]

        # MEMBER sees only their own records
        return [r.to_dict() for r in records if r.user_id == caller_user_id]
