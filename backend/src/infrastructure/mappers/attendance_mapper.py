import json

from domain.attendance.entities import Attendance, Session


class AttendanceMapper:
    @staticmethod
    def to_domain(item: dict) -> Attendance:
        sessions_raw = item.get("sessions", "[]")
        if isinstance(sessions_raw, str):
            sessions_raw = json.loads(sessions_raw)

        sessions = []
        for s in sessions_raw:
            hours = s.get("hours")
            if hours is not None:
                hours = float(hours)
            sessions.append(Session(
                sign_in_at=s["sign_in_at"],
                sign_out_at=s.get("sign_out_at"),
                hours=hours,
                task_id=s.get("task_id"),
                project_id=s.get("project_id"),
                task_title=s.get("task_title"),
                project_name=s.get("project_name"),
                description=s.get("description"),
            ))

        total_hours = item.get("total_hours", 0)
        if total_hours is not None:
            total_hours = float(total_hours)

        return Attendance(
            user_id=item["user_id"],
            date=item["date"],
            sessions=sessions,
            total_hours=total_hours or 0.0,
            user_name=item.get("user_name", ""),
            user_email=item.get("user_email", ""),
            system_role=item.get("system_role", "MEMBER"),
        )

    @staticmethod
    def to_dynamo(attendance: Attendance) -> dict:
        sessions_data = []
        for s in attendance.sessions:
            sd: dict = {"sign_in_at": s.sign_in_at}
            if s.sign_out_at:
                sd["sign_out_at"] = s.sign_out_at
            if s.hours is not None:
                sd["hours"] = str(s.hours)
            if s.task_id:
                sd["task_id"] = s.task_id
            if s.project_id:
                sd["project_id"] = s.project_id
            if s.task_title:
                sd["task_title"] = s.task_title
            if s.project_name:
                sd["project_name"] = s.project_name
            if s.description:
                sd["description"] = s.description
            sessions_data.append(sd)

        return {
            "PK": f"USER#{attendance.user_id}",
            "SK": f"ATTENDANCE#{attendance.date}",
            "GSI1PK": f"ATTENDANCE_DATE#{attendance.date}",
            "GSI1SK": f"USER#{attendance.user_id}",
            "user_id": attendance.user_id,
            "date": attendance.date,
            "sessions": json.dumps(sessions_data),
            "total_hours": str(attendance.total_hours),
            "user_name": attendance.user_name,
            "user_email": attendance.user_email,
            "system_role": attendance.system_role,
        }
