"""
AI service for generating work summaries.
Uses Groq API (LLaMA 3.3 70B).
API key loaded from AWS Secrets Manager at runtime.
"""
import json
import os
import urllib.request
import urllib.error
import boto3

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

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
    Calls Groq LLaMA 3.3 70B to generate a work summary from activity data.
    Returns: { summary, key_activities, productivity_score, concerns }
    """
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("Groq API key not set")

    # Build the prompt
    active_min = activity_data.get("total_active_minutes", 0)
    idle_min = activity_data.get("total_idle_minutes", 0)
    app_usage = activity_data.get("app_usage", {})
    keyboard = sum(b.get("keyboard_count", 0) for b in activity_data.get("buckets", []))
    mouse = sum(b.get("mouse_count", 0) for b in activity_data.get("buckets", []))

    app_lines = []
    for app, seconds in sorted(app_usage.items(), key=lambda x: -x[1]):
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        if hours > 0:
            app_lines.append(f"  - {app}: {hours}h {mins}m")
        elif mins > 0:
            app_lines.append(f"  - {app}: {mins}m")
    app_text = "\n".join(app_lines) if app_lines else "  No app usage data"

    prompt = f"""You are analyzing a work session for an employee. Based on the activity data below, provide a work summary.

## Activity Data
- Total active time: {int(active_min)}m ({round(active_min / 60, 1)}h)
- Total idle time: {int(idle_min)}m
- Keyboard events: {keyboard:,}
- Mouse events: {mouse:,}
- Activity buckets recorded: {len(activity_data.get('buckets', []))}

## App Usage (time spent in each application)
{app_text}

{f"## Task Context" + chr(10) + task_context if task_context else ""}

## Instructions
Respond with ONLY valid JSON (no markdown, no code blocks):
{{
  "summary": "2-3 sentence summary of what the user likely accomplished based on the apps used and activity levels",
  "key_activities": ["activity 1", "activity 2", "activity 3"],
  "productivity_score": 7,
  "concerns": []
}}

Rules:
- productivity_score: 1-10 (10 = highly productive)
- concerns: list any issues like excessive idle time (>30% of total), very low keyboard activity, etc. Empty list if no concerns.
- key_activities: 3-5 inferred activities based on which apps were used
- summary: be specific about what apps suggest (e.g., VS Code = coding, Chrome = research/testing, Slack = communication)
"""

    payload = json.dumps({
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You are a work activity analyzer. Always respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 500,
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

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
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
