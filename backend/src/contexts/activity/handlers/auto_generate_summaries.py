"""
Scheduled Lambda — runs daily at 11:30 PM IST (18:00 UTC).

Multi-tenant: iterates over every Organization in the table and
generates AI summaries for each tenant's users independently. Failure
in one tenant does not affect the others.
"""
import logging
from datetime import datetime, timedelta, timezone

from contexts.activity.application.use_cases import GenerateSummaryUseCase
from contexts.activity.infrastructure.dynamo_repository import ActivityDynamoRepository
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository

logger = logging.getLogger()
logger.setLevel(logging.INFO)

IST = timezone(timedelta(hours=5, minutes=30))


def handler(event, context):
    """Triggered by EventBridge schedule — no auth needed (internal)."""
    today = datetime.now(IST).strftime("%Y-%m-%d")
    logger.info(f"Auto-generating summaries for {today}")

    org_repo = OrgDynamoRepository()
    orgs = org_repo.list_all_orgs()
    logger.info(f"Found {len(orgs)} organizations to process")

    total_generated = 0
    total_errors = 0
    total_users = 0
    per_org_results: list[dict] = []

    for org in orgs:
        try:
            result = _process_one_org(org_id=org.org_id, today=today)
            total_generated += result["generated"]
            total_errors += result["errors"]
            total_users += result["total_users"]
            per_org_results.append({"org_id": org.org_id, **result})
        except Exception as e:
            # One tenant's failure does not block the rest. Log and continue.
            logger.error(f"Org {org.org_id}: auto-generate summaries failed: {e}")
            total_errors += 1
            per_org_results.append({"org_id": org.org_id, "error": str(e)})

    logger.info(
        f"Done. Orgs: {len(orgs)}, Total generated: {total_generated}, "
        f"Total errors: {total_errors}, Total users seen: {total_users}"
    )
    return {
        "orgs_processed": len(orgs),
        "generated": total_generated,
        "errors": total_errors,
        "total_users": total_users,
        "per_org": per_org_results,
    }


def _process_one_org(org_id: str, today: str) -> dict:
    """Generate summaries for every user in one org who has activity
    today and doesn't already have a summary."""
    activity_repo = ActivityDynamoRepository(org_id=org_id)
    activities = activity_repo.find_all_by_date(today)
    if not activities:
        logger.info(f"Org {org_id}: no activity data for today")
        return {"generated": 0, "errors": 0, "total_users": 0}

    use_case = GenerateSummaryUseCase(activity_repo)
    generated = 0
    errors = 0

    for activity in activities:
        # Skip if already has a summary
        existing = activity_repo.find_summary(activity.user_id, today)
        if existing:
            logger.info(
                f"Org {org_id}: summary already exists for {activity.user_name}, skipping"
            )
            continue

        # Skip if less than 3 buckets (< 15 min of tracked time)
        if len(activity.buckets) < 3:
            logger.info(
                f"Org {org_id}: too few buckets for {activity.user_name} "
                f"({len(activity.buckets)}), skipping"
            )
            continue

        try:
            # Use OWNER role to bypass auth check (this is an internal Lambda)
            use_case.execute(
                caller_system_role="OWNER",
                target_user_id=activity.user_id,
                date=today,
            )
            generated += 1
            logger.info(f"Org {org_id}: generated summary for {activity.user_name}")
        except Exception as e:
            errors += 1
            logger.error(
                f"Org {org_id}: failed to generate summary for {activity.user_name}: {e}"
            )

    logger.info(
        f"Org {org_id}: generated={generated}, errors={errors}, "
        f"total_users={len(activities)}"
    )
    return {
        "generated": generated,
        "errors": errors,
        "total_users": len(activities),
    }
