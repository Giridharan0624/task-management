from datetime import datetime, timezone, timedelta

from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.taskupdate.infrastructure.dynamo_repository import TaskUpdateDynamoRepository
from contexts.attendance.infrastructure.dynamo_repository import AttendanceDynamoRepository

IST = timezone(timedelta(hours=5, minutes=30))


def handler(event, context):
    """Check if the current user has a pending or submitted task update."""
    try:
        auth = extract_auth_context(event)

        ist_today = datetime.now(IST).strftime("%Y-%m-%d")
        ist_yesterday = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")

        update_repo = TaskUpdateDynamoRepository()
        attendance_repo = AttendanceDynamoRepository()

        # Priority: check yesterday's unsubmitted work first (overnight scenario)
        yesterday_attendance = attendance_repo.find_by_user_and_date(auth.user_id, ist_yesterday)
        yesterday_update = update_repo.find_by_user_and_date(auth.user_id, ist_yesterday)

        if yesterday_attendance and yesterday_attendance.sessions and not yesterday_update:
            # Yesterday has work but no task update submitted — include attendance for preview
            return build_success(200, {
                "pending_date": ist_yesterday,
                "submitted": False,
                "attendance": yesterday_attendance.to_dict(),
            })

        # Check if already submitted for today
        today_update = update_repo.find_by_user_and_date(auth.user_id, ist_today)
        if today_update:
            return build_success(200, today_update.to_dict())

        # Check if today has attendance (work in progress, not yet submitted)
        today_attendance = attendance_repo.find_by_user_and_date(auth.user_id, ist_today)
        if today_attendance and today_attendance.sessions:
            return build_success(200, None)  # Has work but not submitted yet

        # Check yesterday's submitted update (for display)
        if yesterday_update:
            return build_success(200, yesterday_update.to_dict())

        return build_success(200, None)
    except Exception as e:
        return build_error(e)
