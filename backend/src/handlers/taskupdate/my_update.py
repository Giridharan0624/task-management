from datetime import datetime, timezone, timedelta

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.taskupdate_repository import TaskUpdateDynamoRepository
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository

IST = timezone(timedelta(hours=5, minutes=30))


def handler(event, context):
    """Check if the current user has a pending or submitted task update."""
    try:
        auth = extract_auth_context(event)

        ist_today = datetime.now(IST).strftime("%Y-%m-%d")
        ist_yesterday = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")

        update_repo = TaskUpdateDynamoRepository()
        attendance_repo = AttendanceDynamoRepository()

        # Check if already submitted for today
        update = update_repo.find_by_user_and_date(auth.user_id, ist_today)
        if update:
            return build_success(200, update.to_dict())

        # Check if there's an unsubmitted yesterday (late night work)
        attendance_yesterday = attendance_repo.find_by_user_and_date(auth.user_id, ist_yesterday)
        if attendance_yesterday and attendance_yesterday.sessions:
            update_yesterday = update_repo.find_by_user_and_date(auth.user_id, ist_yesterday)
            if update_yesterday:
                # Already submitted for yesterday — check today's attendance
                attendance_today = attendance_repo.find_by_user_and_date(auth.user_id, ist_today)
                if attendance_today and attendance_today.sessions:
                    return build_success(200, None)  # Has today's work but not submitted yet
                return build_success(200, update_yesterday.to_dict())
            else:
                # Yesterday's work not submitted — flag it
                return build_success(200, {"pending_date": ist_yesterday, "submitted": False})

        return build_success(200, None)
    except Exception as e:
        return build_error(e)
