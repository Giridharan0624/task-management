from datetime import datetime, timezone, timedelta

from contexts.taskupdate.domain.entities import TaskUpdate
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success
from contexts.taskupdate.infrastructure.dynamo_repository import TaskUpdateDynamoRepository
from contexts.attendance.infrastructure.dynamo_repository import AttendanceDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.errors import ValidationError

# IST offset
IST = timezone(timedelta(hours=5, minutes=30))


def _get_ist_today() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        update_repo = TaskUpdateDynamoRepository()
        attendance_repo = AttendanceDynamoRepository()
        user_repo = UserDynamoRepository()

        ist_today = _get_ist_today()
        ist_yesterday = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")

        # Priority logic:
        # 1. If yesterday has attendance AND no task update submitted → use yesterday (late-night work)
        # 2. Otherwise use today's attendance
        attendance = None
        target_date = None

        # Check yesterday first — handles overnight work (started 10 PM, now 2 AM)
        yesterday_attendance = attendance_repo.find_by_user_and_date(auth.user_id, ist_yesterday)
        yesterday_update = update_repo.find_by_user_and_date(auth.user_id, ist_yesterday)

        if yesterday_attendance and yesterday_attendance.sessions and not yesterday_update:
            # Yesterday has unsubmitted work — prioritize it
            attendance = yesterday_attendance
            target_date = ist_yesterday
        else:
            # Check today
            today_attendance = attendance_repo.find_by_user_and_date(auth.user_id, ist_today)
            if today_attendance and today_attendance.sessions:
                attendance = today_attendance
                target_date = ist_today

        if not attendance or not attendance.sessions:
            raise ValidationError("No attendance record found. Start the timer and work before submitting.")

        # Check if already submitted for this date
        existing = update_repo.find_by_user_and_date(auth.user_id, target_date)
        if existing:
            raise ValidationError(f"You have already submitted a task update for {target_date}")

        # Get user info
        user = user_repo.find_by_id(auth.user_id)
        user_name = user.name if user else auth.user_id
        employee_id = user.employee_id if user else None

        # Build task summary from sessions
        task_data: dict[str, dict] = {}  # key -> {hours, descriptions}
        for session in attendance.sessions:
            task_name = session.task_title or "General"
            hrs = session.hours or 0
            if not session.sign_out_at and session.sign_in_at:
                start = datetime.fromisoformat(session.sign_in_at.replace("Z", "+00:00"))
                hrs = (datetime.now(timezone.utc) - start).total_seconds() / 3600
            if task_name not in task_data:
                task_data[task_name] = {"hours": 0, "descriptions": []}
            task_data[task_name]["hours"] += hrs
            if session.description and session.description not in task_data[task_name]["descriptions"]:
                task_data[task_name]["descriptions"].append(session.description)

        task_summary = []
        for task_name, data in task_data.items():
            hours = data["hours"]
            h = int(hours)
            m = int((hours - h) * 60)
            time_str = f"{h}h {m}m" if m > 0 else f"{h}h"
            entry: dict = {"task_name": task_name, "time_recorded": time_str}
            if data["descriptions"]:
                entry["description"] = "; ".join(data["descriptions"])
            task_summary.append(entry)

        task_hours = {name: d["hours"] for name, d in task_data.items()}

        # Sign in = first session start, Sign out = last session end (or now)
        sign_in = attendance.sessions[0].sign_in_at
        last_session = attendance.sessions[-1]
        sign_out = last_session.sign_out_at or datetime.now(timezone.utc).isoformat()

        # Format times in IST for display
        sign_in_dt = datetime.fromisoformat(sign_in.replace("Z", "+00:00")).astimezone(IST)
        sign_out_dt = datetime.fromisoformat(sign_out.replace("Z", "+00:00")).astimezone(IST)
        sign_in_fmt = sign_in_dt.strftime("%I:%M %p")
        sign_out_fmt = sign_out_dt.strftime("%I:%M %p")

        # Calculate total hours including any running session
        total_hours = sum(task_hours.values())
        total_h = int(total_hours)
        total_m = int((total_hours - total_h) * 60)
        total_time = f"{total_h}h {total_m}m" if total_m > 0 else f"{total_h}h"

        update = TaskUpdate.create(
            user_id=auth.user_id,
            user_name=user_name,
            date=target_date,
            sign_in=sign_in_fmt,
            sign_out=sign_out_fmt,
            task_summary=task_summary,
            total_time=total_time,
            employee_id=employee_id,
        )
        update_repo.save(update)

        return build_success(201, update.to_dict())
    except Exception as e:
        return build_error(e)
