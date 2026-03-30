"""
Project Progress Calculation — Multi-Method Approach

Inspired by Adobe Workfront, Jira, Asana, and ClickUp:

1. **Task Completion %** — simple: done_tasks / total_tasks * 100
2. **Weighted Progress %** — each task gets a progress value based on status:
   - TODO = 0%, IN_PROGRESS = 50%, DONE = 100% (50/50 rule)
   - If task has estimated_hours, it's weighted by that estimate
   - Formula: sum(task_weight * task_progress) / sum(task_weight) * 100
3. **Time Budget %** — tracked_hours / estimated_hours * 100
4. **Schedule Health** — based on overdue tasks vs total
5. **Overall Score** — weighted combination of completion + weighted progress
"""

from datetime import datetime, timezone

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from infrastructure.dynamodb.project_repository import ProjectDynamoRepository
from infrastructure.dynamodb.task_repository import TaskDynamoRepository
from infrastructure.dynamodb.attendance_repository import AttendanceDynamoRepository
from infrastructure.dynamodb.user_repository import UserDynamoRepository
from domain.user.value_objects import PRIVILEGED_ROLES
from domain.project.value_objects import ProjectRole

# Status-based progress (50/50 rule used by many PM tools)
STATUS_PROGRESS = {
    "TODO": 0,
    "IN_PROGRESS": 50,
    "DONE": 100,
}

# Priority weights (HIGH tasks count more toward progress)
PRIORITY_WEIGHT = {
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


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

        if auth.system_role not in PRIVILEGED_ROLES:
            member = project_repo.find_member(project_id, auth.user_id)
            if not member or member.project_role not in (ProjectRole.ADMIN, ProjectRole.TEAM_LEAD):
                return build_success(403, {"error": "Access denied"})

        tasks = task_repo.find_by_project(project_id)
        members = project_repo.find_members(project_id)
        now = datetime.now(timezone.utc)

        total_tasks = len(tasks)
        todo_count = sum(1 for t in tasks if t.status.value == "TODO")
        in_progress_count = sum(1 for t in tasks if t.status.value == "IN_PROGRESS")
        done_count = sum(1 for t in tasks if t.status.value == "DONE")

        # ── Method 1: Task Completion (IN_PROGRESS = 50% credit) ──
        completion_pct = round((done_count * 100 + in_progress_count * 50) / total_tasks, 1) if total_tasks > 0 else 0

        # ── Method 2: Weighted Progress (Workfront-style) ──
        # Each task contributes based on: (weight * status_progress)
        # Weight = estimated_hours if set, else priority_weight
        total_weighted_progress = 0.0
        total_weight = 0.0
        for t in tasks:
            weight = t.estimated_hours if t.estimated_hours and t.estimated_hours > 0 else PRIORITY_WEIGHT.get(t.priority.value, 1)
            progress = STATUS_PROGRESS.get(t.status.value, 0)
            total_weighted_progress += weight * progress
            total_weight += weight
        weighted_pct = round(total_weighted_progress / total_weight, 1) if total_weight > 0 else 0

        # ── Method 3: Time Budget ──
        task_estimated_sum = sum(t.estimated_hours or 0 for t in tasks)
        project_estimated = project.estimated_hours or 0
        total_estimated = project_estimated if project_estimated > 0 else task_estimated_sum

        total_tracked = 0.0
        tracked_by_task: dict[str, float] = {}
        tracked_by_user: dict[str, float] = {}

        all_attendance = attendance_repo.find_all_by_date_range(
            project.created_at[:10], "2099-12-31"
        )
        for att in all_attendance:
            for session in att.sessions:
                if session.project_id == project_id and session.hours:
                    total_tracked += session.hours
                    tid = session.task_id or "untracked"
                    tracked_by_task[tid] = tracked_by_task.get(tid, 0) + session.hours
                    tracked_by_user[att.user_id] = tracked_by_user.get(att.user_id, 0) + session.hours

        time_budget_pct = round((total_tracked / total_estimated) * 100, 1) if total_estimated > 0 else 0

        # ── Method 4: Schedule Health ──
        overdue_count = 0
        at_risk_count = 0
        on_track_count = 0
        for t in tasks:
            if t.status.value == "DONE":
                on_track_count += 1
                continue
            try:
                dl = datetime.fromisoformat(t.deadline.replace("Z", "+00:00")) if t.deadline else None
                deadline = dl.replace(tzinfo=timezone.utc) if dl and dl.tzinfo is None else dl
            except Exception:
                deadline = None
            if deadline:
                if now > deadline:
                    overdue_count += 1
                elif (deadline - now).days <= 2:
                    at_risk_count += 1
                else:
                    on_track_count += 1
            else:
                on_track_count += 1

        health = "ON_TRACK"
        if total_tasks > 0:
            overdue_ratio = overdue_count / total_tasks
            if overdue_ratio > 0.3:
                health = "AT_RISK"
            if overdue_ratio > 0.5:
                health = "BEHIND"
            if completion_pct >= 100:
                health = "COMPLETED"

        # ── Method 5: Overall Score — same as completion ──
        overall_score = completion_pct

        # ── Per-task progress ──
        task_progress = []
        for t in tasks:
            est = t.estimated_hours or 0
            tracked = tracked_by_task.get(t.task_id, 0)
            status_pct = STATUS_PROGRESS.get(t.status.value, 0)
            time_pct = round((tracked / est) * 100, 1) if est > 0 else 0

            try:
                dl = datetime.fromisoformat(t.deadline.replace("Z", "+00:00")) if t.deadline else None
                deadline = dl.replace(tzinfo=timezone.utc) if dl and dl.tzinfo is None else dl
            except Exception:
                deadline = None
            is_overdue = bool(deadline and now > deadline and t.status.value != "DONE")

            task_progress.append({
                "task_id": t.task_id,
                "title": t.title,
                "status": t.status.value,
                "priority": t.priority.value,
                "estimated_hours": est,
                "tracked_hours": round(tracked, 2),
                "status_progress": status_pct,
                "time_progress": time_pct,
                "is_overdue": is_overdue,
                "assigned_to": t.assigned_to,
                "deadline": t.deadline,
            })

        # ── Per-member progress ──
        member_progress = []
        for m in members:
            user = user_repo.find_by_id(m.user_id)
            tracked = tracked_by_user.get(m.user_id, 0)
            # Count tasks assigned to this member
            assigned_tasks = [t for t in tasks if m.user_id in t.assigned_to]
            done_tasks = sum(1 for t in assigned_tasks if t.status.value == "DONE")
            ip_tasks = sum(1 for t in assigned_tasks if t.status.value == "IN_PROGRESS")
            member_pct = round((done_tasks * 100 + ip_tasks * 50) / len(assigned_tasks)) if assigned_tasks else 0

            member_progress.append({
                "user_id": m.user_id,
                "name": user.name if user else m.user_id,
                "project_role": m.project_role.value,
                "tracked_hours": round(tracked, 2),
                "total_tasks": len(assigned_tasks),
                "done_tasks": done_tasks,
                "completion_percent": member_pct,
            })

        result = {
            "project_id": project_id,
            "project_name": project.name,

            # Task counts
            "total_tasks": total_tasks,
            "task_counts": {
                "TODO": todo_count,
                "IN_PROGRESS": in_progress_count,
                "DONE": done_count,
            },

            # Progress metrics
            "completion_percent": completion_pct,       # Simple: done/total
            "weighted_progress": weighted_pct,          # Weighted by estimate/priority
            "overall_score": overall_score,             # Combined score
            "time_budget_percent": time_budget_pct,     # Tracked/estimated

            # Time
            "total_estimated_hours": round(total_estimated, 2),
            "total_tracked_hours": round(total_tracked, 2),

            # Health
            "health": health,
            "overdue_count": overdue_count,
            "at_risk_count": at_risk_count,
            "on_track_count": on_track_count,

            # Breakdowns
            "task_progress": task_progress,
            "member_progress": member_progress,
        }

        return build_success(200, result)
    except Exception as e:
        return build_error(e)
