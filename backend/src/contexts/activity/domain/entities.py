from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone


class ActivityBucket(BaseModel):
    """A 5-minute window of activity data from the desktop app."""
    timestamp: str                      # ISO 8601, start of the window
    keyboard_count: int = 0             # Key press events in this window
    mouse_count: int = 0                # Mouse move + click events
    active_seconds: int = 0             # Seconds with input activity
    idle_seconds: int = 0               # Seconds with no input (>2s gap)
    top_app: Optional[str] = None       # App with most usage in this window
    app_breakdown: dict[str, int] = {}  # app name → seconds
    screenshot_url: Optional[str] = None  # CDN URL of screenshot taken in this window


# Score-formula constants. Kept at module level so unit tests can import
# them, and so future tenant-level overrides can stash alternatives here.
KEYBOARD_WEIGHT = 1.5
"""A keystroke counts 1.5× a mouse event when measuring engagement.
Mouse events are easier to generate passively (hovering, scrolling),
so we weight keyboard input higher."""

TARGET_EVENTS_PER_ACTIVE_MINUTE = 40
"""Baseline throughput that represents 'normal, engaged' work. A day
that hits or exceeds this rate during active time gets full intensity
credit. Tunable per tenant later if needed."""

PRESENCE_WEIGHT = 0.7
"""Share of the score contributed by presence (time at the machine)."""

INTENSITY_WEIGHT = 0.3
"""Share of the score contributed by engagement intensity. Must sum to 1
with PRESENCE_WEIGHT."""


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
    def total_keystrokes(self) -> int:
        """Sum of keyboard_count across every bucket for the day."""
        return sum(b.keyboard_count for b in self.buckets)

    @property
    def total_mouse_events(self) -> int:
        """Sum of mouse_count across every bucket for the day."""
        return sum(b.mouse_count for b in self.buckets)

    @property
    def presence(self) -> float:
        """0.0 to 1.0 — fraction of tracked time that was active.

        This is the legacy `activity_score` formula, preserved so
        clients that want the raw "time at keyboard" metric still have
        access to it separately from the composite score."""
        total = self.total_active_minutes + self.total_idle_minutes
        if total == 0:
            return 0.0
        return self.total_active_minutes / total

    @property
    def intensity(self) -> float:
        """0.0 to 1.0 — engagement throughput vs the target rate.

        Capped at 1.0 so a very fast typist cannot skew team averages.
        Keyboard input is weighted higher than mouse input because
        mouse events are easier to generate passively."""
        active_minutes = max(1.0, self.total_active_minutes)
        weighted_events = (
            KEYBOARD_WEIGHT * self.total_keystrokes + self.total_mouse_events
        )
        rate = weighted_events / active_minutes
        return min(1.0, rate / TARGET_EVENTS_PER_ACTIVE_MINUTE)

    @property
    def activity_score(self) -> float:
        """Composite score — 0.0 to 1.0.

        score = PRESENCE_WEIGHT × presence + INTENSITY_WEIGHT × intensity

        Presence dominates (70% by default) because being at the machine
        is most of the work. Intensity contributes the remaining 30% so
        wiggle-mouse patterns cannot inflate the score, and focused
        high-throughput work earns a bonus.

        If nothing was tracked for the day the score is 0.0 — not 0.7 ×
        0 + 0.3 × something, because intensity is undefined when there
        is no active time.
        """
        total = self.total_active_minutes + self.total_idle_minutes
        if total == 0:
            return 0.0
        return round(
            PRESENCE_WEIGHT * self.presence + INTENSITY_WEIGHT * self.intensity,
            2,
        )

    def add_bucket(self, bucket: ActivityBucket) -> None:
        """Add a new activity bucket and update totals."""
        self.buckets.append(bucket)
        self.total_active_minutes += bucket.active_seconds / 60.0
        self.total_idle_minutes += bucket.idle_seconds / 60.0

        # Merge app breakdown into daily totals
        for app, seconds in bucket.app_breakdown.items():
            self.app_usage[app] = self.app_usage.get(app, 0) + seconds

    @property
    def screenshots(self) -> list[dict]:
        """All screenshots from the day, chronologically."""
        return [
            {"url": b.screenshot_url, "timestamp": b.timestamp}
            for b in self.buckets if b.screenshot_url
        ]

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "date": self.date,
            "buckets": [b.model_dump() for b in self.buckets],
            "total_active_minutes": round(self.total_active_minutes, 1),
            "total_idle_minutes": round(self.total_idle_minutes, 1),
            "total_keystrokes": self.total_keystrokes,
            "total_mouse_events": self.total_mouse_events,
            "activity_score": self.activity_score,
            # Sub-scores so the frontend can explain WHY the composite
            # score is what it is — useful for the "score breakdown"
            # tooltip / panel without re-deriving the numbers in JS.
            "presence": round(self.presence, 2),
            "intensity": round(self.intensity, 2),
            "app_usage": self.app_usage,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "bucket_count": len(self.buckets),
            "screenshots": self.screenshots,
        }


class DailySummary(BaseModel):
    """AI-generated daily work summary for a user."""
    user_id: str
    date: str
    summary: str = ""
    key_activities: list[str] = []
    productivity_score: int = 0          # 1-10
    concerns: list[str] = []
    total_active_minutes: float = 0.0
    total_idle_minutes: float = 0.0
    app_usage: dict[str, int] = {}
    generated_at: str = ""
    user_name: str = ""

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "date": self.date,
            "summary": self.summary,
            "key_activities": self.key_activities,
            "productivity_score": self.productivity_score,
            "concerns": self.concerns,
            "total_active_minutes": round(self.total_active_minutes, 1),
            "total_idle_minutes": round(self.total_idle_minutes, 1),
            "app_usage": self.app_usage,
            "generated_at": self.generated_at,
            "user_name": self.user_name,
        }
