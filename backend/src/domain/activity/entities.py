from pydantic import BaseModel
from typing import Optional


class ActivityBucket(BaseModel):
    """A 5-minute window of activity data from the desktop app."""
    timestamp: str                      # ISO 8601, start of the window
    keyboard_count: int = 0             # Key press events in this window
    mouse_count: int = 0                # Mouse move + click events
    active_seconds: int = 0             # Seconds with input activity
    idle_seconds: int = 0               # Seconds with no input (>2s gap)
    top_app: Optional[str] = None       # App with most usage in this window
    app_breakdown: dict[str, int] = {}  # app name → seconds


class UserActivity(BaseModel):
    """Daily activity record for a user."""
    user_id: str
    date: str                                   # YYYY-MM-DD
    buckets: list[ActivityBucket] = []
    total_active_minutes: float = 0.0
    total_idle_minutes: float = 0.0
    app_usage: dict[str, int] = {}              # app name → total seconds for the day
    user_name: str = ""
    user_email: str = ""

    @property
    def activity_score(self) -> float:
        """0.0 to 1.0 — ratio of active time to total tracked time."""
        total = self.total_active_minutes + self.total_idle_minutes
        if total == 0:
            return 0.0
        return round(self.total_active_minutes / total, 2)

    def add_bucket(self, bucket: ActivityBucket) -> None:
        """Add a new activity bucket and update totals."""
        self.buckets.append(bucket)
        self.total_active_minutes += bucket.active_seconds / 60.0
        self.total_idle_minutes += bucket.idle_seconds / 60.0

        # Merge app breakdown into daily totals
        for app, seconds in bucket.app_breakdown.items():
            self.app_usage[app] = self.app_usage.get(app, 0) + seconds

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "date": self.date,
            "buckets": [b.model_dump() for b in self.buckets],
            "total_active_minutes": round(self.total_active_minutes, 1),
            "total_idle_minutes": round(self.total_idle_minutes, 1),
            "activity_score": self.activity_score,
            "app_usage": self.app_usage,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "bucket_count": len(self.buckets),
        }
