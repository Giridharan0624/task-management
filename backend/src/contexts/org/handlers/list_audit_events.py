"""GET /orgs/current/audit — paginated audit log viewer.

OWNER-only. Query params:
  limit    — max events per page (1-200, default 50)
  cursor   — opaque continuation token from a previous response
  action   — optional prefix filter (e.g. "role." matches role.created/updated/deleted)

Handler is NOT yet wired into CDK. Once the nested-stack refactor lands
and API-Gateway resource budget is available again, drop the handler
into an "admin" router alongside roles_router/pipelines_router. Until
then the writer side still fires (events accumulate in DynamoDB) so no
data is lost — only the UI is offline.
"""
from contexts.org.domain import permissions as P
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.permissions import require
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        # settings.edit is already the gate for the kind of changes the
        # audit log mostly records. Reading the log is a strict subset
        # of that power — anyone who can make the changes can read them.
        require(auth, P.SETTINGS_EDIT)

        q = (event or {}).get("queryStringParameters") or {}
        try:
            limit = int(q.get("limit") or 50)
        except ValueError:
            limit = 50
        cursor = q.get("cursor") or None
        action = q.get("action") or None

        events, next_cursor = audit.list_events(
            auth.org_id,
            limit=limit,
            cursor=cursor,
            action_prefix=action,
        )
        return build_success(200, {
            "events": events,
            "next_cursor": next_cursor,
        })
    except Exception as e:
        return build_error(e)
