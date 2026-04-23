"""Activity-score formula tests.

Score = PRESENCE_WEIGHT × presence + INTENSITY_WEIGHT × intensity

  presence  = active_min / (active_min + idle_min)
  intensity = min(1, (1.5 × keys + mouse) / active_min / TARGET)

with PRESENCE_WEIGHT = 0.7, INTENSITY_WEIGHT = 0.3, TARGET = 40 events/min,
KEYBOARD_WEIGHT = 1.5.

These tests pin the formula behaviour and serve as documentation.
"""
from contexts.activity.domain.entities import (
    ActivityBucket,
    UserActivity,
    PRESENCE_WEIGHT,
    INTENSITY_WEIGHT,
    TARGET_EVENTS_PER_ACTIVE_MINUTE,
    KEYBOARD_WEIGHT,
)


def _build(active_min: float, idle_min: float, keys: int, mouse: int) -> UserActivity:
    """Synthesize a UserActivity with one bucket carrying the totals.
    The bucket-level breakdown doesn't matter to the score — only the
    daily totals do — so a single bucket keeps tests readable."""
    activity = UserActivity(user_id="u1", date="2026-04-23")
    activity.add_bucket(
        ActivityBucket(
            timestamp="2026-04-23T09:00:00Z",
            keyboard_count=keys,
            mouse_count=mouse,
            active_seconds=int(active_min * 60),
            idle_seconds=int(idle_min * 60),
        )
    )
    return activity


def test_constants_sum_to_one():
    """If presence + intensity weights drift apart from 1 the score
    leaves the [0,1] range."""
    assert PRESENCE_WEIGHT + INTENSITY_WEIGHT == 1.0


def test_empty_day_is_zero():
    activity = UserActivity(user_id="u1", date="2026-04-23")
    assert activity.activity_score == 0.0
    assert activity.presence == 0.0


def test_full_presence_full_intensity():
    """8h active, no idle, well above the input baseline → score ~ 1.0."""
    activity = _build(active_min=480, idle_min=0, keys=20000, mouse=10000)
    assert activity.presence == 1.0
    assert activity.intensity == 1.0
    assert activity.activity_score == 1.0


def test_full_presence_zero_intensity():
    """Was always at the machine but produced zero input — should
    floor at PRESENCE_WEIGHT (0.7 by default)."""
    activity = _build(active_min=480, idle_min=0, keys=0, mouse=0)
    assert activity.presence == 1.0
    assert activity.intensity == 0.0
    assert activity.activity_score == round(PRESENCE_WEIGHT, 2)


def test_zero_presence_high_intensity_capped():
    """Tracker says zero active minutes but somehow has events. The
    `max(1, active_min)` guard keeps intensity finite; presence is 0
    so the score collapses to 0.3 × intensity."""
    activity = _build(active_min=0, idle_min=480, keys=1000, mouse=1000)
    # Intensity divisor is max(1, 0) = 1; (1.5*1000 + 1000) / 1 / 40 = 62.5 → cap 1.0
    assert activity.intensity == 1.0
    assert activity.presence == 0.0
    assert activity.activity_score == round(INTENSITY_WEIGHT, 2)


def test_screenshot_user_at_baseline():
    """The user from the design screenshot:
       active=376m, idle=104m, keys=25770, mouse=12726.
       Their input rate (~137 events/min) is way above target → intensity=1.
       Score = 0.7 × 0.7833 + 0.3 × 1 = 0.8483."""
    activity = _build(active_min=376, idle_min=104, keys=25770, mouse=12726)
    assert round(activity.presence, 4) == 0.7833
    assert activity.intensity == 1.0
    assert activity.activity_score == 0.85


def test_wiggle_farmer_is_punished():
    """High presence (95%), almost no input → score should land near
    the presence floor, far below the legacy presence-only score."""
    activity = _build(active_min=456, idle_min=24, keys=20, mouse=200)
    # weighted = 1.5*20 + 200 = 230; rate = 230/456 = ~0.5 events/min
    # intensity = 0.5 / 40 = ~0.013
    assert activity.intensity < 0.05
    assert activity.activity_score < 0.7
    # And clearly less than the old presence-only score of 0.95.
    assert activity.activity_score < activity.presence - 0.2


def test_keyboard_weighted_higher_than_mouse():
    """Two users with identical raw event totals but different
    keyboard/mouse splits — the keyboard-heavy user should score higher."""
    keyboard_heavy = _build(active_min=300, idle_min=60, keys=8000, mouse=2000)
    mouse_heavy = _build(active_min=300, idle_min=60, keys=2000, mouse=8000)
    # Keyboard weight is 1.5 → keyboard-heavy weighted events are higher.
    assert keyboard_heavy.activity_score > mouse_heavy.activity_score


def test_intensity_caps_at_one_for_power_typist():
    """A 200 wpm power typist shouldn't pull the team average up."""
    activity = _build(active_min=240, idle_min=0, keys=80000, mouse=0)
    # weighted = 1.5*80000 = 120000; rate = 120000/240 = 500 events/min
    # intensity raw = 500/40 = 12.5 → cap to 1.0
    assert activity.intensity == 1.0


def test_to_dict_exposes_breakdown():
    """Frontend needs presence/intensity separately to render the
    'score breakdown' tooltip without re-doing the math."""
    activity = _build(active_min=300, idle_min=60, keys=1000, mouse=500)
    d = activity.to_dict()
    assert "presence" in d
    assert "intensity" in d
    assert "activity_score" in d
    assert "total_keystrokes" in d
    assert "total_mouse_events" in d
    assert d["total_keystrokes"] == 1000
    assert d["total_mouse_events"] == 500


def test_target_baseline_unchanged_at_40():
    """Pin the baseline so accidental tweaks during refactors don't
    silently change every workspace's numbers."""
    assert TARGET_EVENTS_PER_ACTIVE_MINUTE == 40
    assert KEYBOARD_WEIGHT == 1.5
