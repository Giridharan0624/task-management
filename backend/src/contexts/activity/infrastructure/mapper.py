import json
from contexts.activity.domain.entities import UserActivity, ActivityBucket, DailySummary
from shared_kernel import tenant_keys


class ActivityMapper:
    @staticmethod
    def to_dynamo(activity: UserActivity) -> dict:
        return {
            "PK": f"USER#{activity.user_id}",
            "SK": f"ACTIVITY#{activity.date}",
            "GSI1PK": f"ACTIVITY_DATE#{activity.date}",
            "GSI1SK": f"USER#{activity.user_id}",
            "user_id": activity.user_id,
            "date": activity.date,
            "buckets": json.dumps([b.model_dump() for b in activity.buckets]),
            "total_active_minutes": str(round(activity.total_active_minutes, 1)),
            "total_idle_minutes": str(round(activity.total_idle_minutes, 1)),
            "app_usage": json.dumps(activity.app_usage),
            "user_name": activity.user_name,
            "user_email": activity.user_email,
        }

    @staticmethod
    def to_domain(item: dict) -> UserActivity:
        buckets_raw = item.get("buckets", "[]")
        if isinstance(buckets_raw, str):
            buckets_raw = json.loads(buckets_raw)

        app_usage_raw = item.get("app_usage", "{}")
        if isinstance(app_usage_raw, str):
            app_usage_raw = json.loads(app_usage_raw)

        buckets = [ActivityBucket(**b) for b in buckets_raw]

        return UserActivity(
            user_id=item.get("user_id", ""),
            date=item.get("date", ""),
            buckets=buckets,
            total_active_minutes=float(item.get("total_active_minutes", 0)),
            total_idle_minutes=float(item.get("total_idle_minutes", 0)),
            app_usage=app_usage_raw,
            user_name=item.get("user_name", ""),
            user_email=item.get("user_email", ""),
        )

    @staticmethod
    def to_dynamo_v2(activity: UserActivity, org_id: str) -> dict:
        """Org-scoped copy for Phase 1 dual-write."""
        item = ActivityMapper.to_dynamo(activity)
        item["PK"] = tenant_keys.user_pk(org_id, activity.user_id)
        item["GSI1PK"] = tenant_keys.activity_date_gsi1pk(org_id, activity.date)
        item["org_id"] = org_id
        return item

    @staticmethod
    def summary_to_dynamo(summary: DailySummary) -> dict:
        return {
            "PK": f"USER#{summary.user_id}",
            "SK": f"SUMMARY#{summary.date}",
            "user_id": summary.user_id,
            "date": summary.date,
            "summary": summary.summary,
            "key_activities": json.dumps(summary.key_activities),
            "productivity_score": summary.productivity_score,
            "concerns": json.dumps(summary.concerns),
            "total_active_minutes": str(round(summary.total_active_minutes, 1)),
            "total_idle_minutes": str(round(summary.total_idle_minutes, 1)),
            "app_usage": json.dumps(summary.app_usage),
            "generated_at": summary.generated_at,
            "user_name": summary.user_name,
        }

    @staticmethod
    def summary_to_dynamo_v2(summary: DailySummary, org_id: str) -> dict:
        """Org-scoped copy for Phase 1 dual-write."""
        item = ActivityMapper.summary_to_dynamo(summary)
        item["PK"] = tenant_keys.user_pk(org_id, summary.user_id)
        item["org_id"] = org_id
        return item

    @staticmethod
    def summary_to_domain(item: dict) -> DailySummary:
        key_activities = item.get("key_activities", "[]")
        if isinstance(key_activities, str):
            key_activities = json.loads(key_activities)
        concerns = item.get("concerns", "[]")
        if isinstance(concerns, str):
            concerns = json.loads(concerns)
        app_usage = item.get("app_usage", "{}")
        if isinstance(app_usage, str):
            app_usage = json.loads(app_usage)

        return DailySummary(
            user_id=item.get("user_id", ""),
            date=item.get("date", ""),
            summary=item.get("summary", ""),
            key_activities=key_activities,
            productivity_score=int(item.get("productivity_score", 0)),
            concerns=concerns,
            total_active_minutes=float(item.get("total_active_minutes", 0)),
            total_idle_minutes=float(item.get("total_idle_minutes", 0)),
            app_usage=app_usage,
            generated_at=item.get("generated_at", ""),
            user_name=item.get("user_name", ""),
        )
