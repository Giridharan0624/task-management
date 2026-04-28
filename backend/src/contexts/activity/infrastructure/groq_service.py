"""
AI service for generating daily-activity summaries.

Multimodal call against Groq's Llama 4 Scout. The model receives:
  · the activity-metadata prompt (active time, app usage, scores)
  · every screenshot the day captured, as image-URL parts

Llama 4 Scout was chosen over Maverick because Scout is cheaper per
token at comparable vision quality for our use case (UI / app-window
inference, not photo understanding). If you switch to Maverick, only
GROQ_VISION_MODEL needs to change — the message shape is identical.

API key loaded from AWS Secrets Manager at runtime.

Model constants are split into two roles:
  - GROQ_VISION_MODEL: multimodal — daily summary (this file)
  - GROQ_TEXT_MODEL:   text-only — weekly rollup, future text paths

Decoupling them lets each surface pick the right model without
silently dragging the other along when one changes. Previously both
imported a single `GROQ_MODEL` constant, which meant flipping the
activity context to a multimodal model also flipped the weekly
rollup to a smaller multimodal model that was a quality regression
for its text-only workload.
"""
import json
import os
import urllib.request
import urllib.error
import boto3

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Vision-capable model — daily activity summary.
# Llama 4 Scout (17B params, 16-expert MoE) is Groq's cheap
# multimodal default. Pre-Llama-4 Groq vision models
# (llama-3.2-90b-vision-preview, etc.) have been retired.
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Text-only model — weekly rollup, anomaly explanation, any future
# text path. 70B params, dense (no MoE), tuned for analytical text.
# Cheaper per call than Scout for text workloads because the prompt
# is much shorter (no image tokens) and Groq's pricing on the dense
# 70B is competitive with the MoE Scout for text-only requests.
GROQ_TEXT_MODEL = "llama-3.3-70b-versatile"

# Backwards-compatible alias. External callers that imported
# GROQ_MODEL continue to work — they get the vision model, which
# matches the historical behaviour of "the model that handles the
# activity summary". New code should pick the role-appropriate
# constant explicitly. Remove this alias once no callers reference
# it (search the repo for GROQ_MODEL before removing).
GROQ_MODEL = GROQ_VISION_MODEL

# Hard cap on images per request. A user with the timer running for
# a full 8h day generates ~48 screenshots (one every ~9.5 min). The
# cap is intentionally above that so a normal day always fits, but
# bounded to keep cost predictable on an outlier "ran the timer for
# 16 hours straight" session.
MAX_SCREENSHOTS_PER_SUMMARY = 64

_cached_api_key = None


def _get_api_key() -> str:
    """Load API key from Secrets Manager (cached after first call)."""
    global _cached_api_key
    if _cached_api_key:
        return _cached_api_key

    secret_arn = os.environ.get("GROQ_SECRET_ARN", "")
    if secret_arn:
        client = boto3.client("secretsmanager")
        response = client.get_secret_value(SecretId=secret_arn)
        secret_str = response.get("SecretString", "")
        try:
            secret_data = json.loads(secret_str)
            _cached_api_key = secret_data.get("api_key", secret_str)
        except json.JSONDecodeError:
            _cached_api_key = secret_str
        return _cached_api_key

    key = os.environ.get("GROQ_API_KEY", "")
    if key:
        _cached_api_key = key
        return key

    raise RuntimeError("Groq API key not configured")


def generate_work_summary(activity_data: dict, task_context: str = "") -> dict:
    """
    Calls Groq's Llama 4 Scout vision model with the day's activity
    metadata AND every captured screenshot. Returns:
      { summary, key_activities, productivity_score, concerns }

    Screenshots are referenced by URL — Groq fetches them server-side
    from the public CloudFront distribution we already use for the
    in-app gallery. No image bytes leave AWS through us; the model
    fetches directly. Frame count is capped at
    MAX_SCREENSHOTS_PER_SUMMARY to bound runaway cost on extreme
    sessions.
    """
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("Groq API key not set")

    # Build the prompt
    active_min = activity_data.get("total_active_minutes", 0)
    idle_min = activity_data.get("total_idle_minutes", 0)
    app_usage = activity_data.get("app_usage", {})
    # to_dict() now exposes these directly — fall back to per-bucket
    # summation only if an older payload shape is passed in.
    keyboard = activity_data.get(
        "total_keystrokes",
        sum(b.get("keyboard_count", 0) for b in activity_data.get("buckets", [])),
    )
    mouse = activity_data.get(
        "total_mouse_events",
        sum(b.get("mouse_count", 0) for b in activity_data.get("buckets", [])),
    )
    # Objective sub-scores from the new composite formula
    # (PRESENCE_WEIGHT × presence + INTENSITY_WEIGHT × intensity).
    # Passed in so the AI's narrative aligns with the math instead of
    # contradicting it.
    presence = activity_data.get("presence", 0.0)
    intensity = activity_data.get("intensity", 0.0)
    activity_score = activity_data.get("activity_score", 0.0)

    app_lines = []
    for app, seconds in sorted(app_usage.items(), key=lambda x: -x[1]):
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        if hours > 0:
            app_lines.append(f"  - {app}: {hours}h {mins}m")
        elif mins > 0:
            app_lines.append(f"  - {app}: {mins}m")
    app_text = "\n".join(app_lines) if app_lines else "  No app usage data"

    intervals = len(activity_data.get("buckets", []))
    task_block = (
        f"<task_context>\n{task_context.strip()}\n</task_context>"
        if task_context
        else ""
    )

    # Pull the screenshot CDN URLs out of the activity payload.
    # `screenshots` is a list of {url, timestamp} (see UserActivity.to_dict)
    # — chronological. Cap at MAX_SCREENSHOTS_PER_SUMMARY to bound
    # cost; anything longer than 64 frames is almost always
    # repetitive idle frames anyway.
    raw_screenshots = activity_data.get("screenshots", []) or []
    screenshot_entries = [
        s for s in raw_screenshots
        if isinstance(s, dict) and s.get("url")
    ][:MAX_SCREENSHOTS_PER_SUMMARY]
    screenshot_count = len(screenshot_entries)
    truncated = len(raw_screenshots) > MAX_SCREENSHOTS_PER_SUMMARY
    screenshot_note = (
        f"You have been given {screenshot_count} screenshot(s) captured "
        "throughout the day, evenly spaced ~9-10 minutes apart. Use them "
        "to identify the actual content the user was working on (file "
        "names, document titles, IDE projects, browser tabs). "
        + ("(Day was long — frames after the cap are not shown.) "
           if truncated else "")
        + "Cite specifics from screenshots ('opened payments-v2 PR', "
        "'reviewed Q3 OKR doc') instead of generic claims. If frames "
        "look repetitive or idle, say so."
        if screenshot_count > 0
        else "No screenshots were captured for this session."
    )

    prompt = f"""<role>
You are TaskFlow's Daily Activity Analyst. You receive passive
desktop-monitoring data — application usage, input throughput, and
active/idle time — and produce a short, honest written summary of one
team member's workday.

You are NOT the user. You are inferring what they likely did from
indirect evidence. Hedge accordingly: "appears to", "likely spent",
"consistent with". Never claim to know intent or feelings.
</role>

<audience>
A team manager or workspace owner who has thirty seconds to read your
output before moving to the next person. Make those seconds count.
Specific is better than flattering. Honest is better than impressive.
</audience>

<inputs>
<time>
- Active time:        {int(active_min)} min  ({round(active_min / 60, 1)} h)
- Idle time:          {int(idle_min)} min
- Recorded intervals: {intervals}  (each = a 5-minute window)
</time>

<input_throughput>
- Keystrokes:    {keyboard:,}
- Mouse events:  {mouse:,}
</input_throughput>

<objective_scores>
These three scores are deterministically computed BEFORE you see the
data. You may explain or contextualise them, but you must NOT generate
numbers that disagree with them.

- Presence:        {round(presence * 100)}%   (active time / total tracked time)
- Intensity:       {round(intensity * 100)}%   (weighted input rate vs 40 events/min target, capped at 100%)
- Composite score: {round(activity_score * 100)}%   (0.7 × presence + 0.3 × intensity)
</objective_scores>

<app_usage>
{app_text}
</app_usage>

<screenshots>
{screenshot_note}
</screenshots>

{task_block}
</inputs>

<output_schema>
Respond with ONLY this JSON object. No markdown fences, no preamble,
no trailing prose.

{{
  "summary":            <string, 2-3 sentences>,
  "key_activities":     <array of 3 to 5 short strings>,
  "productivity_score": <integer 1-10, qualitative — see scale>,
  "concerns":           <array of 0 to 3 short strings>
}}
</output_schema>

<style_guide>
Write like a senior analyst, not a coach. The reader is a busy
manager, not the person being summarised.

DO:
- Name specific apps and time blocks ("4h 12m in VS Code").
- Hedge inferences ("appears to", "likely", "consistent with").
- Use the screenshots to ground specifics: file names, branch names,
  document titles, browser tabs visible at the time. "Working on
  src/api/client.go in VS Code" beats "coding".
- Reconcile with the objective scores. If composite < 50%, do not
  call the day "highly productive". If intensity < 30%, name the
  low throughput as part of the picture.
- Keep concerns short — under twelve words each, observation not
  accusation.

DO NOT:
- Use generic praise ("great day", "amazing", "crushed it").
- Pretend to know what the user "meant" to do or how they felt.
- Pad with empty phrases ("a wide range of activities").
- Invent numbers. The only numbers you may quote are those above.
- Make up content you can't see in the screenshots. If a frame is
  blurry, locked-screen, or a desktop wallpaper, say so honestly.
- Repeat the same point in summary AND concerns.
- Quote text verbatim from screenshots that looks personal,
  sensitive, or credentials-like (passwords, API keys, customer
  PII). Reference the activity at the level of "edited an API
  client" not "typed CUSTOMER_SECRET=…".
</style_guide>

<productivity_scale>
This 1-10 score is your QUALITATIVE read on work quality given the
app mix and rhythm. It is distinct from the composite score (which is
pure math). It MAY diverge from the composite by 2-3 points if the
apps justify it; larger divergence requires explicit justification in
the summary.

Calibration:
- 10  Sustained deep work in a clearly productive tool, high intensity throughout.
- 8-9 Strong day in productive tools (code, design, docs, terminals); reasonable focus.
- 6-7 Mixed productive day, OR a meeting/comms-heavy day with legitimate output.
- 4-5 Some productive signal, but most time in browsers/comms without clear purpose.
- 2-3 Mostly idle, or apparent distraction (entertainment / news dominant).
- 1   Almost no signal of work happening.
</productivity_scale>

<concerns_catalogue>
Pick AT MOST three. Only include those that are genuinely supported by
the data above. Phrase as observations, never accusations.

Examples of well-formed concerns:
- "Idle time exceeded 30% of tracked time"
- "Input intensity well below the 40 events/min baseline"
- "Most active time spent in browsers without clear research signal"
- "Short tracked day — only NN minutes of activity recorded"
- "Mouse-heavy with low keyboard activity — review/browsing pattern"
- "Single-app dominance — over 80% of active time in one tool"

Empty array `[]` if nothing worth flagging.
</concerns_catalogue>

<good_example>
{{
  "summary": "Likely spent the day on backend code in VS Code (4h 12m) with periodic Slack check-ins (38m). Input intensity remained strong, consistent with active implementation rather than review.",
  "key_activities": ["Coding in VS Code", "Team coordination on Slack", "Brief documentation lookup in Chrome"],
  "productivity_score": 8,
  "concerns": []
}}
</good_example>

<bad_example>
{{
  "summary": "Great day full of energy! The user accomplished many important tasks across various tools and showed amazing focus throughout.",
  "key_activities": ["Working hard", "Being productive", "Multitasking"],
  "productivity_score": 10,
  "concerns": []
}}
</bad_example>
"""

    # Multimodal user message: text prompt first (so the model sees
    # the rules and the metadata before the imagery), then every
    # screenshot URL as a separate image part. Groq fetches each URL
    # server-side; the bytes never pass through our backend.
    user_content: list = [{"type": "text", "text": prompt}]
    for shot in screenshot_entries:
        user_content.append({
            "type": "image_url",
            "image_url": {"url": shot["url"]},
        })

    payload = json.dumps({
        "model": GROQ_VISION_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are TaskFlow's Daily Activity Analyst. You receive "
                    "activity metadata AND a chronological set of desktop "
                    "screenshots. Output ONLY a single JSON object matching "
                    "the schema in the user message — no markdown, no code "
                    "fences, no commentary before or after. Be specific, "
                    "hedge inferences, ground claims in what you see in the "
                    "screenshots, and never contradict the objective scores "
                    "you are given. Never echo sensitive text (passwords, "
                    "API keys, customer PII) from the screenshots."
                ),
            },
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.3,
        # Bumped from 500 — vision summaries cite specifics
        # (file names, branches, tab titles) and can need a bit
        # more budget than the text-only path used.
        "max_tokens": 700,
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "TaskFlow/1.0",
        },
    )

    # Vision calls fetch every image-URL server-side and run
    # multimodal inference, so they're meaningfully slower than the
    # text-only path was. 90s gives a 64-image day plenty of room
    # without locking up the Lambda for too long when Groq is
    # slow / backed up.
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"Groq API error {e.code}: {body}")

    # Extract the AI response
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

    # Parse JSON from response
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {
            "summary": content[:500],
            "key_activities": [],
            "productivity_score": 5,
            "concerns": ["AI response was not valid JSON"],
        }

    return {
        "summary": str(parsed.get("summary", ""))[:1000],
        "key_activities": parsed.get("key_activities", [])[:10],
        "productivity_score": max(1, min(10, int(parsed.get("productivity_score", 5)))),
        "concerns": parsed.get("concerns", [])[:5],
    }
