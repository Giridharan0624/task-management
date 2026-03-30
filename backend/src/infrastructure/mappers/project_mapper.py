from domain.project.entities import Project, ProjectMember
from domain.project.value_objects import ProjectRole


class ProjectMapper:
    @staticmethod
    def project_to_domain(item: dict) -> Project:
        return Project(
            project_id=item["project_id"],
            name=item["name"],
            description=item.get("description"),
            estimated_hours=float(item["estimated_hours"]) if item.get("estimated_hours") is not None else None,
            created_by=item["created_by"],
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def project_to_dynamo(project: Project) -> dict:
        item: dict = {
            "PK": f"PROJECT#{project.project_id}",
            "SK": "METADATA",
            "project_id": project.project_id,
            "name": project.name,
            "created_by": project.created_by,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }
        if project.description is not None:
            item["description"] = project.description
        if project.estimated_hours is not None:
            item["estimated_hours"] = str(project.estimated_hours)
        return item

    @staticmethod
    def member_to_domain(item: dict) -> ProjectMember:
        return ProjectMember(
            project_id=item["project_id"],
            user_id=item["user_id"],
            project_role=ProjectRole(item["project_role"]),
            added_by=item.get("added_by"),
            joined_at=item["joined_at"],
        )

    @staticmethod
    def member_to_dynamo(member: ProjectMember) -> dict:
        item = {
            "PK": f"PROJECT#{member.project_id}",
            "SK": f"MEMBER#{member.user_id}",
            "GSI1PK": f"USER#{member.user_id}",
            "GSI1SK": f"PROJECT#{member.project_id}",
            "project_id": member.project_id,
            "user_id": member.user_id,
            "project_role": member.project_role.value,
            "joined_at": member.joined_at,
        }
        if member.added_by:
            item["added_by"] = member.added_by
        return item
