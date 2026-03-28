from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from domain.user.value_objects import SystemRole, PRIVILEGED_ROLES
from domain.project.value_objects import ProjectRole


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        path_params = event.get("pathParameters") or {}
        project_id = path_params.get("projectId", "")

        project_repo = ProjectDynamoRepository()
        task_repo = TaskDynamoRepository()
        attendance_repo = AttendanceDynamoRepository()
        user_repo = UserDynamoRepository()

        project = project_repo.find_by_id(project_id)
        if not project:
            return build_success(404, {"error": "Project not found"})

        # Check access — only OWNER, CEO, MD, ADMIN (system), or TEAM_LEAD (project)
        if auth.system_role not in PRIVILEGED_ROLES:
            member = project_repo.find_member(project_id, auth.user_id)
            if not member or member.project_role not in (ProjectRole.ADMIN, ProjectRole.TEAM_LEAD):
                return build_success(403, {"error": "Only owners, admins, and team leads can view project progress"})

        tasks = task_repo.find_by_project(project_id)
        members = project_repo.find_members(project_id)

        # Task stats
        total_tasks = len(tasks)
        todo_count = sum(1 for t in tasks if t.status.value == "TODO")
        in_progress_count = sum(1 for t in tasks if t.status.value == "IN_PROGRESS")
        done_count = sum(1 for t in tasks if t.status.value == "DONE")

        # Estimated hours: use project-level if set, otherwise sum task estimates
        task_estimated_sum = sum(t.estimated_hours or 0 for t in tasks)
        project_estimated = project.estimated_hours or 0
        total_estimated = project_estimated if project_estimated > 0 else task_estimated_sum
        estimated_by_task = []
        for t in tasks:
            estimated_by_task.append({
                "task_id": t.task_id,
                "title": t.title,
                "status": t.status.value,
                "priority": t.priority.value,
                "estimated_hours": t.estimated_hours,
                "assigned_to": t.assigned_to,
                "deadline": t.deadline,
            })

        # Tracked hours from attendance (aggregate all sessions with this project's tasks)
        total_tracked = 0.0
        tracked_by_task: dict[str, float] = {}
        tracked_by_user: dict[str, float] = {}

        # Get all attendance records — scan all to find sessions for this project
        all_attendance = attendance_repo.find_all_by_date_range("2020-01-01", "2099-12-31")
        for att in all_attendance:
            for session in att.sessions:
                if session.project_id == project_id and session.hours:
                    total_tracked += session.hours
                    tid = session.task_id or "untracked"
                    tracked_by_task[tid] = tracked_by_task.get(tid, 0) + session.hours
                    tracked_by_user[att.user_id] = tracked_by_user.get(att.user_id, 0) + session.hours

        # Build task progress
        task_progress = []
        for t in tasks:
            est = t.estimated_hours or 0
            tracked = tracked_by_task.get(t.task_id, 0)
            pct = round((tracked / est) * 100, 1) if est > 0 else 0
            task_progress.append({
                "task_id": t.task_id,
                "title": t.title,
                "status": t.status.value,
                "priority": t.priority.value,
                "estimated_hours": est,
                "tracked_hours": round(tracked, 2),
                "progress_percent": pct,
                "assigned_to": t.assigned_to,
                "deadline": t.deadline,
            })

        # Build member progress
        member_progress = []
        for m in members:
            user = user_repo.find_by_id(m.user_id)
            tracked = tracked_by_user.get(m.user_id, 0)
            member_progress.append({
                "user_id": m.user_id,
                "name": user.name if user else m.user_id,
                "project_role": m.project_role.value,
                "tracked_hours": round(tracked, 2),
            })

        # Overall progress
        overall_pct = round((total_tracked / total_estimated) * 100, 1) if total_estimated > 0 else 0
        completion_pct = round((done_count / total_tasks) * 100, 1) if total_tasks > 0 else 0

        result = {
            "project_id": project_id,
            "project_name": project.name,
            "total_tasks": total_tasks,
            "task_counts": {
                "TODO": todo_count,
                "IN_PROGRESS": in_progress_count,
                "DONE": done_count,
            },
            "total_estimated_hours": round(total_estimated, 2),
            "total_tracked_hours": round(total_tracked, 2),
            "time_progress_percent": overall_pct,
            "completion_percent": completion_pct,
            "task_progress": task_progress,
            "member_progress": member_progress,
        }

        return build_success(200, result)
    except Exception as e:
        return build_error(e)
