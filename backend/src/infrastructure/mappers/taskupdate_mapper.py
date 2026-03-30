import json

from domain.taskupdate.entities import TaskUpdate, TaskSummaryItem


class TaskUpdateMapper:
    @staticmethod
    def to_domain(item: dict) -> TaskUpdate:
        summary_raw = item.get("task_summary", "[]")
        if isinstance(summary_raw, str):
            summary_raw = json.loads(summary_raw)

        return TaskUpdate(
            update_id=item["update_id"],
            user_id=item["user_id"],
            user_name=item["user_name"],
            employee_id=item.get("employee_id"),
            date=item["date"],
            sign_in=item["sign_in"],
            sign_out=item["sign_out"],
            task_summary=[TaskSummaryItem(**s) for s in summary_raw],
            total_time=item["total_time"],
            created_at=item["created_at"],
        )

    @staticmethod
    def to_dynamo(update: TaskUpdate) -> dict:
        return {
            "PK": f"TASKUPDATE#{update.date}",
            "SK": f"USER#{update.user_id}#{update.update_id}",
            "GSI1PK": f"USER#{update.user_id}",
            "GSI1SK": f"TASKUPDATE#{update.date}",
            "update_id": update.update_id,
            "user_id": update.user_id,
            "user_name": update.user_name,
            "employee_id": update.employee_id or "",
            "date": update.date,
            "sign_in": update.sign_in,
            "sign_out": update.sign_out,
            "task_summary": json.dumps(
                [{"task_name": t.task_name, "time_recorded": t.time_recorded} for t in update.task_summary]
            ),
            "total_time": update.total_time,
            "created_at": update.created_at,
        }
