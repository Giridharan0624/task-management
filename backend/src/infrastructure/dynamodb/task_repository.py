from typing import Optional

from boto3.dynamodb.conditions import Key

from domain.task.entities import Task
from domain.task.repository import ITaskRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.task_mapper import TaskMapper


class TaskDynamoRepository(ITaskRepository):
    def __init__(self):
        self._table = get_table()

    def find_by_id(self, task_id: str) -> Optional[Task]:
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"TASK#{task_id}"),
        )
        items = response.get("Items", [])
        if not items:
            return None
        return TaskMapper.to_domain(items[0])

    def find_by_project(self, project_id: str) -> list[Task]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}")
            & Key("SK").begins_with("TASK#"),
        )
        items = response.get("Items", [])
        tasks = [TaskMapper.to_domain(item) for item in items]

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}")
                & Key("SK").begins_with("TASK#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            tasks.extend(TaskMapper.to_domain(item) for item in response.get("Items", []))

        return tasks

    def save(self, task: Task) -> None:
        item = TaskMapper.to_dynamo(task)
        self._table.put_item(Item=item)

    def update(self, task: Task) -> None:
        item = TaskMapper.to_dynamo(task)
        self._table.put_item(Item=item)

    def delete(self, task_id: str, project_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": f"TASK#{task_id}"}
        )

    def delete_all_by_project(self, project_id: str) -> None:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}")
            & Key("SK").begins_with("TASK#"),
        )
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}")
                & Key("SK").begins_with("TASK#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
