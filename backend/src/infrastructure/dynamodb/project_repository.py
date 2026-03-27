from typing import Optional

from boto3.dynamodb.conditions import Key

from domain.project.entities import Project, ProjectMember
from domain.project.repository import IProjectRepository
from infrastructure.dynamodb.client import get_table
from infrastructure.mappers.project_mapper import ProjectMapper


class ProjectDynamoRepository(IProjectRepository):
    def __init__(self):
        self._table = get_table()

    def find_by_id(self, project_id: str) -> Optional[Project]:
        response = self._table.get_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        return ProjectMapper.project_to_domain(item)

    def save(self, project: Project) -> None:
        item = ProjectMapper.project_to_dynamo(project)
        self._table.put_item(Item=item)

    def delete(self, project_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": "METADATA"}
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

    def save_member(self, member: ProjectMember) -> None:
        item = ProjectMapper.member_to_dynamo(member)
        self._table.put_item(Item=item)

    def remove_member(self, project_id: str, user_id: str) -> None:
        self._table.delete_item(
            Key={"PK": f"PROJECT#{project_id}", "SK": f"MEMBER#{user_id}"}
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
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}")
        )
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = self._table.query(
                KeyConditionExpression=Key("PK").eq(f"PROJECT#{project_id}"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
