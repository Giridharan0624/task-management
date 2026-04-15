from typing import Optional

from boto3.dynamodb.conditions import Key

from contexts.task.domain.entities import Task
from contexts.task.domain.repository import ITaskRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import DEFAULT_ORG_ID
from shared_kernel import tenant_keys
from contexts.task.infrastructure.mapper import TaskMapper


class TaskDynamoRepository(ITaskRepository):
    def __init__(self, org_id: str = DEFAULT_ORG_ID):
        self._table = get_table()
        self._org_id = org_id

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
        self._table.put_item(Item=TaskMapper.to_dynamo(task))
        self._table.put_item(Item=TaskMapper.to_dynamo_v2(task, self._org_id))

    def update(self, task: Task) -> None:
        self._table.put_item(Item=TaskMapper.to_dynamo(task))
        self._table.put_item(Item=TaskMapper.to_dynamo_v2(task, self._org_id))

    def delete(self, task_id: str, project_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": f"TASK#{task_id}"}
        )
        self._table.delete_item(
            Key={"PK": tenant_keys.project_pk(self._org_id, project_id), "SK": f"TASK#{task_id}"}
        )

    def delete_all_by_project(self, project_id: str) -> None:
        legacy_pk = f"PROJECT#{project_id}"
        v2_pk = tenant_keys.project_pk(self._org_id, project_id)

        all_items: list[dict] = []
        for pk in (legacy_pk, v2_pk):
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(pk)
                & Key("SK").begins_with("TASK#"),
            )
            all_items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self._table.query(
                    KeyConditionExpression=Key("PK").eq(pk)
                    & Key("SK").begins_with("TASK#"),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                all_items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in all_items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
