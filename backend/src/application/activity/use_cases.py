from datetime import datetime, timezone

from domain.activity.entities import UserActivity, ActivityBucket, DailySummary
from domain.activity.repository import IActivityRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from infrastructure.ai.groq_service import generate_work_summary
from shared.errors import ValidationError, AuthorizationError


PRIVILEGED_ROLES = {"OWNER", "ADMIN"}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


class RecordHeartbeatUseCase:
    """Receives a 5-minute activity bucket from the desktop app and appends it to the daily record."""

    def __init__(self, activity_repo: IActivityRepository, user_repo: UserDynamoRepository):
        self._activity_repo = activity_repo
        self._user_repo = user_repo

    def execute(self, caller_user_id: str, data: dict) -> dict:
        date = _today()

        # Validate required fields
        keyboard_count = data.get("keyboard_count", 0)
        mouse_count = data.get("mouse_count", 0)
        active_seconds = data.get("active_seconds", 0)
        idle_seconds = data.get("idle_seconds", 0)
        top_app = data.get("top_app", "")
        app_breakdown = data.get("app_breakdown", {})
        timestamp = data.get("timestamp", datetime.now(timezone.utc).isoformat())

        if not isinstance(keyboard_count, int) or keyboard_count < 0:
            raise ValidationError("Invalid keyboard_count")
        if not isinstance(mouse_count, int) or mouse_count < 0:
            raise ValidationError("Invalid mouse_count")
        if not isinstance(active_seconds, int) or active_seconds < 0:
            raise ValidationError("Invalid active_seconds")
        if active_seconds + idle_seconds > 600:  # Max 10 minutes per bucket (5 min + buffer)
            raise ValidationError("Bucket duration exceeds maximum")

        bucket = ActivityBucket(
            timestamp=timestamp,
            keyboard_count=keyboard_count,
            mouse_count=mouse_count,
            active_seconds=active_seconds,
            idle_seconds=idle_seconds,
            top_app=top_app[:50] if top_app else None,  # Sanitize app name length
            app_breakdown={k[:50]: v for k, v in list(app_breakdown.items())[:20]},  # Max 20 apps
        )

        # Get or create daily activity record
        activity = self._activity_repo.find_by_user_and_date(caller_user_id, date)
        if not activity:
            # Get user info for display
            user = self._user_repo.find_by_id(caller_user_id)
            activity = UserActivity(
                user_id=caller_user_id,
                date=date,
                user_name=user.name if user else "",
                user_email=user.email if user else "",
            )

        activity.add_bucket(bucket)
        self._activity_repo.save(activity)

        return {"status": "recorded", "bucket_count": len(activity.buckets)}


class GetMyActivityUseCase:
    """Returns the caller's activity for a given date."""

    def __init__(self, activity_repo: IActivityRepository):
        self._activity_repo = activity_repo

    def execute(self, caller_user_id: str, date: str = None) -> dict | None:
        date = date or _today()
        activity = self._activity_repo.find_by_user_and_date(caller_user_id, date)
        if not activity:
            return None
        return activity.to_dict()


class GetActivityReportUseCase:
    """Returns activity data for all users in a date range. Admin only."""

    def __init__(self, activity_repo: IActivityRepository):
        self._activity_repo = activity_repo

    def execute(self, caller_system_role: str, start_date: str, end_date: str) -> list[dict]:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only admins can view activity reports")

        if not start_date or not end_date:
            raise ValidationError("start_date and end_date are required")

        activities = self._activity_repo.find_all_by_date_range(start_date, end_date)
        return [a.to_dict() for a in activities]


class GenerateSummaryUseCase:
    """Generates an AI work summary for a user's daily activity. Admin only."""

    def __init__(self, activity_repo: IActivityRepository):
        self._activity_repo = activity_repo

    def execute(self, caller_system_role: str, target_user_id: str, date: str, task_context: str = "") -> dict:
        if caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("Only admins can generate summaries")

        if not target_user_id or not date:
            raise ValidationError("user_id and date are required")

        # Get the user's activity for the day
        activity = self._activity_repo.find_by_user_and_date(target_user_id, date)
        if not activity:
            raise ValidationError(f"No activity data found for {date}")

        if len(activity.buckets) == 0:
            raise ValidationError("No activity buckets recorded for this day")

        # Call Groq AI
        ai_result = generate_work_summary(activity.to_dict(), task_context)

        # Build and save summary
        summary = DailySummary(
            user_id=target_user_id,
            date=date,
            summary=ai_result["summary"],
            key_activities=ai_result["key_activities"],
            productivity_score=ai_result["productivity_score"],
            concerns=ai_result["concerns"],
            total_active_minutes=activity.total_active_minutes,
            total_idle_minutes=activity.total_idle_minutes,
            app_usage=activity.app_usage,
            generated_at=datetime.now(timezone.utc).isoformat(),
            user_name=activity.user_name,
        )

        self._activity_repo.save_summary(summary)
        return summary.to_dict()


class GetSummaryUseCase:
    """Returns a stored AI summary for a user+date."""

    def __init__(self, activity_repo: IActivityRepository):
        self._activity_repo = activity_repo

    def execute(self, caller_user_id: str, caller_system_role: str, target_user_id: str, date: str) -> dict | None:
        # Users can view their own summary; admins can view anyone's
        if caller_user_id != target_user_id and caller_system_role not in PRIVILEGED_ROLES:
            raise AuthorizationError("You can only view your own summary")

        if not date:
            date = _today()

        summary = self._activity_repo.find_summary(target_user_id, date)
        if not summary:
            return None
        return summary.to_dict()
