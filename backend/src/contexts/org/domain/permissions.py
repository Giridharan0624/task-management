"""Phase 4 — permission constants.

A permission is a `<resource>.<action>[.<scope>]` string. Roles carry a set
of these strings. Handlers ask the shared `require(ctx, "perm")` helper —
they never inspect roles directly anymore.

Granular enough to express the OWNER/ADMIN/MEMBER differences from the
legacy `PRIVILEGED_ROLES` checks while leaving room for future per-tenant
custom roles to subset/superset them.
"""

# ---- Settings & roles ----
SETTINGS_VIEW = "settings.view"
SETTINGS_EDIT = "settings.edit"
ROLE_MANAGE = "role.manage"
BILLING_VIEW = "billing.view"

# ---- Users ----
USER_LIST = "user.list"
USER_VIEW_PROGRESS = "user.progress.view"
USER_INVITE = "user.invite"
USER_CREATE = "user.create"
USER_UPDATE_ANY = "user.update.any"
USER_UPDATE_OWN = "user.update.own"
USER_DELETE = "user.delete"
USER_ROLE_MANAGE = "user.role.manage"

# ---- Projects ----
PROJECT_CREATE = "project.create"
PROJECT_LIST_ALL = "project.list.all"
PROJECT_MEMBERS_LIST = "project.members.list"
PROJECT_MEMBERS_MANAGE = "project.members.manage"
PROJECT_EDIT = "project.edit"
PROJECT_DELETE = "project.delete"

# ---- Tasks ----
TASK_CREATE = "task.create"
TASK_LIST = "task.list"
TASK_VIEW_ALL = "task.view.all"
TASK_UPDATE_ANY = "task.update.any"
TASK_UPDATE_OWN = "task.update.own"
TASK_DELETE_ANY = "task.delete.any"
TASK_MANAGE = "task.manage"

# ---- Comments ----
COMMENT_CREATE = "comment.create"
COMMENT_LIST = "comment.list"

# ---- Day-offs ----
DAYOFF_REQUEST = "dayoff.request"
DAYOFF_LIST_ALL = "dayoff.request.list.all"
DAYOFF_APPROVE = "dayoff.approve"
DAYOFF_REJECT = "dayoff.reject"

# ---- Attendance ----
ATTENDANCE_REPORT_VIEW = "attendance.report.view"

# ---- Activity ----
ACTIVITY_REPORT_VIEW = "activity.report.view"
ACTIVITY_SUMMARY_GENERATE = "activity.summary.generate"

# ---- Task updates ----
TASKUPDATE_LIST_ALL = "taskupdate.list.all"


ALL_PERMISSIONS: frozenset[str] = frozenset({
    SETTINGS_VIEW, SETTINGS_EDIT, ROLE_MANAGE, BILLING_VIEW,
    USER_LIST, USER_VIEW_PROGRESS, USER_INVITE, USER_CREATE,
    USER_UPDATE_ANY, USER_UPDATE_OWN, USER_DELETE, USER_ROLE_MANAGE,
    PROJECT_CREATE, PROJECT_LIST_ALL, PROJECT_MEMBERS_LIST,
    PROJECT_MEMBERS_MANAGE, PROJECT_EDIT, PROJECT_DELETE,
    TASK_CREATE, TASK_LIST, TASK_VIEW_ALL, TASK_UPDATE_ANY,
    TASK_UPDATE_OWN, TASK_DELETE_ANY, TASK_MANAGE,
    COMMENT_CREATE, COMMENT_LIST,
    DAYOFF_REQUEST, DAYOFF_LIST_ALL, DAYOFF_APPROVE, DAYOFF_REJECT,
    ATTENDANCE_REPORT_VIEW,
    ACTIVITY_REPORT_VIEW, ACTIVITY_SUMMARY_GENERATE,
    TASKUPDATE_LIST_ALL,
})
