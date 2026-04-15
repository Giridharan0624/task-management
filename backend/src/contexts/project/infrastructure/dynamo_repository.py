from typing import Optional

from boto3.dynamodb.conditions import Attr, Key

from contexts.project.domain.entities import Project, ProjectMember
from contexts.project.domain.repository import IProjectRepository
from shared_kernel.dynamo_client import get_table
from shared_kernel.tenant_keys import DEFAULT_ORG_ID
from shared_kernel import tenant_keys
from contexts.project.infrastructure.mapper import ProjectMapper


class ProjectDynamoRepository(IProjectRepository):
    def __init__(self, org_id: str = DEFAULT_ORG_ID):
        self._table = get_table()
        self._org_id = org_id

    def find_by_id(self, project_id: str) -> Optional[Project]:
        response = self._table.get_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        return ProjectMapper.project_to_domain(item)

    def save(self, project: Project) -> None:
        self._table.put_item(Item=ProjectMapper.project_to_dynamo(project))
        self._table.put_item(Item=ProjectMapper.project_to_dynamo_v2(project, self._org_id))

    def delete(self, project_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": "METADATA"}
        )
        self._table.delete_item(
            Key={"PK": tenant_keys.project_pk(self._org_id, project_id), "SK": "METADATA"}
        )

    def find_projects_for_user(self, user_id: str) -> list[Project]:
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"USER#{user_id}")
            & Key("GSI1SK").begins_with("PROJECT#"),
        )
        items = response.get("Items", [])

        projects: list[Project] = []
        for item in items:
            project_id = item["project_id"]
            project = self.find_by_id(project_id)
            if project:
                projects.append(project)

        return projects

    def find_all(self) -> list[Project]:
        response = self._table.scan(
            FilterExpression=Attr("SK").eq("METADATA")
            & Attr("PK").begins_with("PROJECT#"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = self._table.scan(
                FilterExpression=Attr("SK").eq("METADATA")
                & Attr("PK").begins_with("PROJECT#"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return [ProjectMapper.project_to_domain(item) for item in items]

    def save_member(self, member: ProjectMember) -> None:
        self._table.put_item(Item=ProjectMapper.member_to_dynamo(member))
        self._table.put_item(Item=ProjectMapper.member_to_dynamo_v2(member, self._org_id))

    def remove_member(self, project_id: str, user_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": f"MEMBER#{user_id}"}
        )
        self._table.delete_item(
            Key={"PK": tenant_keys.project_pk(self._org_id, project_id), "SK": f"MEMBER#{user_id}"}
        )

    def find_member(self, project_id: str, user_id: str) -> Optional[ProjectMember]:
        response = self._table.get_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": f"MEMBER#{user_id}"}
        )
        item = response.get("Item")
        if not item:
            return None
        return ProjectMapper.member_to_domain(item)

    def find_members(self, project_id: str) -> list[ProjectMember]:
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}")
            & Key("SK").begins_with("MEMBER#"),
        )
        items = response.get("Items", [])
        return [ProjectMapper.member_to_domain(item) for item in items]

    def delete_all_project_data(self, project_id: str) -> None:
        # Collect both legacy and org-scoped items for this project
        legacy_pk = f"PROJECT#{project_id}"
        v2_pk = tenant_keys.project_pk(self._org_id, project_id)

        all_items: list[dict] = []
        for pk in (legacy_pk, v2_pk):
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(pk)
            )
            all_items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = self._table.query(
                    KeyConditionExpression=Key("PK").eq(pk),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                all_items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in all_items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
