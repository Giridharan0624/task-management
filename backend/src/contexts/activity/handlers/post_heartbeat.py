import json
import logging
from datetime import datetime, timezone

from contexts.activity.application.use_cases import RecordHeartbeatUseCase
from contexts.activity.infrastructure.dynamo_repository import ActivityDynamoRepository
from contexts.attendance.infrastructure.dynamo_repository import AttendanceDynamoRepository
from contexts.user.infrastructure.dynamo_repository import UserDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.response import build_error, build_success

logger = logging.getLogger()


def handler(event, context):
    try:
        auth = extract_auth_context(event)

        body = {}
        raw_body = event.get("body")
        if raw_body:
            body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        activity_repo = ActivityDynamoRepository()
        user_repo = UserDynamoRepository()
        use_case = RecordHeartbeatUseCase(activity_repo, user_repo)
        result = use_case.execute(caller_user_id=auth.user_id, data=body)

        # Stamp the active attendance session with a fresh heartbeat
        # timestamp so the stale-session sweep can close abandoned
        # sessions at the last-known-alive moment (not at sweep time).
        # Best-effort: a failure here must not bounce the caller's
        # heartbeat — the sweep already tolerates occasional misses
        # via its multi-interval grace window.
        _stamp_attendance_heartbeat(auth.user_id)

        return build_success(201, result)
    except Exception as e:
        return build_error(e)


def _stamp_attendance_heartbeat(user_id: str) -> None:
    try:
        now = datetime.now(timezone.utc)
        # Sessions are keyed by IST date on entities.Attendance.create;
        # mirror that so we find the right row on a heartbeat that
        # arrives at (e.g.) 18:30 UTC = 00:00 IST the next day.
        from contexts.attendance.domain.entities import IST
        today_ist = now.astimezone(IST).strftime("%Y-%m-%d")
        attendance_repo = AttendanceDynamoRepository()
        attendance = attendance_repo.find_by_user_and_date(user_id, today_ist)
        if attendance is None or not attendance.is_signed_in:
            return
        attendance_repo.save(attendance.record_heartbeat(now))
    except Exception as exc:
        logger.warning("post_heartbeat: failed to stamp attendance heartbeat: %s", exc)
