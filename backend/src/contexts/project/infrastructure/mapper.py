from contexts.org.domain.default_project_roles import (
    PROJECT_MEMBER_ROLE_ID,
    normalize_project_role_id,
)
from contexts.project.domain.entities import Project, ProjectMember
from shared_kernel import tenant_keys


class ProjectMapper:
    @staticmethod
    def project_to_domain(item: dict) -> Project:
        return Project(
            project_id=item["project_id"],
            name=item["name"],
            description=item.get("description"),
            estimated_hours=float(item["estimated_hours"]) if item.get("estimated_hours") is not None else None,
            domain=item.get("domain", "DEVELOPMENT"),
            created_by=item["created_by"],
            created_at=item["created_at"],
            updated_at=item["updated_at"],
        )

    @staticmethod
    def project_to_dynamo(project: Project, org_id: str) -> dict:
        item: dict = {
            "PK": tenant_keys.project_pk(org_id, project.project_id),
            "SK": tenant_keys.project_metadata_sk(),
            "org_id": org_id,
            "project_id": project.project_id,
            "name": project.name,
            "created_by": project.created_by,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        }
        item["domain"] = project.domain
        if project.description is not None:
            item["description"] = project.description
        if project.estimated_hours is not None:
            item["estimated_hours"] = str(project.estimated_hours)
        return item

    @staticmethod
    def member_to_domain(item: dict) -> ProjectMember:
        # Pre-refactor records stored the role as the legacy enum value
        # in `project_role` (ADMIN / PROJECT_MANAGER / TEAM_LEAD / MEMBER).
        # Post-refactor records store the prefixed role_id in
        # `project_role_id`. Prefer the new field; fall back by
        # translating the legacy value via `normalize_project_role_id`.
        raw_id = item.get("project_role_id")
        if not raw_id:
            raw_id = item.get("project_role", PROJECT_MEMBER_ROLE_ID)
        return ProjectMember(
            project_id=item["project_id"],
            user_id=item["user_id"],
            project_role_id=normalize_project_role_id(raw_id),
            added_by=item.get("added_by"),
            joined_at=item["joined_at"],
        )

    @staticmethod
    def member_to_dynamo(member: ProjectMember, org_id: str) -> dict:
        item = {
            "PK": tenant_keys.project_pk(org_id, member.project_id),
            "SK": tenant_keys.project_member_sk(member.user_id),
            "GSI1PK": tenant_keys.user_projects_gsi1pk(org_id, member.user_id),
            "GSI1SK": f"PROJECT#{member.project_id}",
            "org_id": org_id,
            "project_id": member.project_id,
            "user_id": member.user_id,
            # Write only the new field. Legacy `project_role` attribute
            # is intentionally dropped on update — mapper read-path
            # still translates historical records.
            "project_role_id": member.project_role_id,
            "joined_at": member.joined_at,
        }
        if member.added_by:
            item["added_by"] = member.added_by
        return item
