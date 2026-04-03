"""
Scheduled Lambda — runs daily at 11:30 PM IST (18:00 UTC).
Generates AI summaries for all users who had activity today.
"""
import logging
from datetime import datetime, timezone, timedelta

from application.activity.use_cases import GenerateSummaryUseCase
from infrastructure.dynamodb.activity_repository import ActivityDynamoRepository

logger = logging.getLogger()
logger.setLevel(logging.INFO)

IST = timezone(timedelta(hours=5, minutes=30))


def handler(event, context):
    """Triggered by EventBridge schedule — no auth needed (internal)."""
    try:
        today = datetime.now(IST).strftime("%Y-%m-%d")
        logger.info(f"Auto-generating summaries for {today}")

        activity_repo = ActivityDynamoRepository()

        # Get all users with activity today
        activities = activity_repo.find_all_by_date(today)
        if not activities:
            logger.info("No activity data found for today")
            return {"generated": 0}

        use_case = GenerateSummaryUseCase(activity_repo)
        generated = 0
        errors = 0

        for activity in activities:
            # Skip if already has a summary
            existing = activity_repo.find_summary(activity.user_id, today)
            if existing:
                logger.info(f"Summary already exists for {activity.user_name}, skipping")
                continue

            # Skip if less than 3 buckets (< 15 min of tracked time)
            if len(activity.buckets) < 3:
                logger.info(f"Too few buckets for {activity.user_name} ({len(activity.buckets)}), skipping")
                continue

            try:
                # Use OWNER role to bypass auth check (this is an internal Lambda)
                use_case.execute(
                    caller_system_role="OWNER",
                    target_user_id=activity.user_id,
                    date=today,
                )
                generated += 1
                logger.info(f"Generated summary for {activity.user_name}")
            except Exception as e:
                errors += 1
                logger.error(f"Failed to generate summary for {activity.user_name}: {e}")

        logger.info(f"Done. Generated: {generated}, Errors: {errors}, Skipped: {len(activities) - generated - errors}")
        return {"generated": generated, "errors": errors, "total_users": len(activities)}

    except Exception as e:
        logger.error(f"Auto-generate summaries failed: {e}")
        raise
