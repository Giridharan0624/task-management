"""Public GET /orgs/by-slug/{slug} handler.

Called by the login page to resolve a workspace-code into the org's
display metadata (name, logo, primary color, Cognito client config) so
the login screen can theme itself *before* the user types any credentials.

Response is safe to expose to unauthenticated callers — it contains only
branding fields, not any org-internal data.
"""
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.errors import NotFoundError
from shared_kernel.response import build_error, build_success


def handler(event, context):
    try:
        slug = (event.get("pathParameters") or {}).get("slug", "").strip().lower()
        if not slug:
            raise NotFoundError("Workspace not found")

        repo = OrgDynamoRepository()
        org = repo.find_by_slug(slug)
        if not org:
            raise NotFoundError("Workspace not found")

        settings = repo.get_settings(org.org_id)

        return build_success(200, {
            "org_id": org.org_id,
            "slug": org.slug,
            "name": org.name,
            "status": org.status.value,
            "display_name": settings.display_name if settings else org.name,
            "logo_url": settings.logo_url if settings else None,
            "primary_color": settings.primary_color if settings else "#4F46E5",
            "accent_color": settings.accent_color if settings else "#10B981",
        })
    except Exception as e:
        return build_error(e)
