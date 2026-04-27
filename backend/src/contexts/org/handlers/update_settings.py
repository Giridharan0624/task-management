"""Authed PUT /orgs/current/settings — OWNER-only.

Merges the submitted fields into the current OrgSettings and writes the
result back. Unknown fields are ignored; a partial payload only changes
the fields it includes.

Safe to expose any subset of OrgSettings from the frontend — the
handler only accepts the shape defined below and rejects anything else.
"""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from contexts.dayoff.infrastructure.dynamo_repository import DayOffDynamoRepository
from contexts.org.domain import permissions as P
from contexts.org.domain.entities import OrgSettings
from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel import audit
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import NotFoundError, ValidationError
from shared_kernel.permissions import require, require_email_verified, require_not_suspended
from shared_kernel.response import build_error, build_success
from shared_kernel.validate_body import validate_body


class UpdateSettingsRequest(BaseModel):
    # Branding
    display_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    # Curated-font picker — id from frontend/src/lib/tenant/fonts.ts
    font_family: Optional[str] = None
    # Curated theme preset — id from frontend/src/lib/tenant/themes.ts
    theme: Optional[str] = None
    # Terminology overrides (i18n)
    terminology: Optional[dict[str, str]] = None
    # Locale
    timezone: Optional[str] = None
    locale: Optional[str] = None
    currency: Optional[str] = None
    week_start_day: Optional[int] = Field(default=None, ge=0, le=6)
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    # Identity
    employee_id_prefix: Optional[str] = None
    # Feature toggles (dict bool)
    features: Optional[dict[str, bool]] = None
    # Leave types
    leave_types: Optional[list[dict]] = None
    # Department catalog (OWNER-managed). List of plain strings.
    departments: Optional[list[str]] = None


def handler(event, context):
    try:
        auth = extract_auth_context(event)
        require_not_suspended(auth)
        require_email_verified(auth)
        require(auth, P.SETTINGS_EDIT)

        req = validate_body(UpdateSettingsRequest, event.get("body"))

        repo = OrgDynamoRepository()
        current = repo.get_settings(auth.org_id)
        if not current:
            raise NotFoundError("Organization settings not found.")

        # Merge: only the fields the caller sent are changed
        updates = req.model_dump(exclude_unset=True)
        _validate_updates(updates)

        # Block destructive leave_types edits — if any leave_type id present in
        # historical day-offs is being removed, refuse so we don't orphan
        # records and break the balance widget. This is a conservative check;
        # the owner can still rename a *label* (the `name` field) freely as
        # long as the `id` stays the same.
        if "leave_types" in updates:
            _guard_leave_type_removal(current.leave_types or [], updates["leave_types"] or [])

        merged = current.model_copy(update=updates)
        merged.updated_at = datetime.now(timezone.utc).isoformat()

        repo.save_settings(merged)
        # Audit which field groups changed (not each value — leaks PII).
        changed_keys = sorted(updates.keys())
        audit.record(
            auth,
            action=audit.ORG_SETTINGS_UPDATED,
            target={"type": "settings", "id": auth.org_id},
            summary=f"Updated {', '.join(changed_keys)}" if changed_keys else "Updated settings",
            metadata={"changed": changed_keys},
        )
        return build_success(200, merged.to_dict())
    except Exception as e:
        return build_error(e)


_HEX_COLOR_LEN = {4, 7, 9}  # #rgb, #rrggbb, #rrggbbaa

# Whitelist of theme preset ids — must stay in sync with the
# `THEMES` catalog in frontend/src/lib/tenant/themes.ts. Stored as
# a short id rather than the palette payload so the canonical
# definition lives in one place (the frontend catalog) and the
# backend just validates the identifier.
#
# Legacy ids (slate/graphite/sapphire/forest/claret) from the v1
# staging catalog are still accepted because the frontend `getTheme`
# helper aliases them onto the v2 successors — preserving the choice
# any early-tester tenant made without a hard migration step.
_ALLOWED_THEMES = {
    "aurora",
    "atelier",
    "meridian",
    "cypress",
    "velour",
    # Legacy aliases — accepted for backward compatibility.
    "slate",
    "graphite",
    "sapphire",
    "forest",
    "claret",
}


def _validate_updates(updates: dict) -> None:
    """Server-side validation of a partial settings payload."""
    if "primary_color" in updates:
        _validate_hex_color(updates["primary_color"], "primary_color")
    if "accent_color" in updates:
        _validate_hex_color(updates["accent_color"], "accent_color")
    if "display_name" in updates:
        name = updates["display_name"]
        if not isinstance(name, str) or not (1 <= len(name) <= 100):
            raise ValidationError("display_name must be 1-100 characters.")
    if "employee_id_prefix" in updates:
        prefix = updates["employee_id_prefix"]
        if not isinstance(prefix, str) or len(prefix) > 10:
            raise ValidationError("employee_id_prefix must be at most 10 characters.")
    if "working_hours_start" in updates:
        _validate_time_str(updates["working_hours_start"], "working_hours_start")
    if "working_hours_end" in updates:
        _validate_time_str(updates["working_hours_end"], "working_hours_end")
    if "timezone" in updates and not isinstance(updates["timezone"], str):
        raise ValidationError("timezone must be a string.")
    if "theme" in updates:
        theme = updates["theme"]
        if not isinstance(theme, str) or theme not in _ALLOWED_THEMES:
            raise ValidationError(
                f"Unknown theme. Pick one of: {', '.join(sorted(_ALLOWED_THEMES))}."
            )


def _validate_hex_color(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.startswith("#"):
        raise ValidationError(f"{field} must be a hex color like #4F46E5.")
    if len(value) not in _HEX_COLOR_LEN:
        raise ValidationError(f"{field} must be a hex color like #4F46E5.")
    try:
        int(value[1:], 16)
    except ValueError:
        raise ValidationError(f"{field} must be a hex color like #4F46E5.")


def _guard_leave_type_removal(before: list[dict], after: list[dict]) -> None:
    """Block edits that drop a leave_type id with live day-off records.

    Renaming the `name` of a type is fine; renaming/deleting the `id` is
    what breaks historical references. We scan *all* (not just APPROVED)
    day-offs because PENDING records also point to the id.
    """
    before_ids = {(lt or {}).get("id") for lt in before if (lt or {}).get("id")}
    after_ids = {(lt or {}).get("id") for lt in after if (lt or {}).get("id")}
    removed = before_ids - after_ids
    if not removed:
        return

    # Only run the (potentially expensive) scan when something was removed.
    repo = DayOffDynamoRepository()
    in_use = set()
    for r in repo.find_all():
        if r.leave_type_id in removed:
            in_use.add(r.leave_type_id)
            if in_use == removed:
                break

    if in_use:
        raise ValidationError(
            "Cannot remove leave types that have existing day-off requests: "
            + ", ".join(sorted(in_use))
            + ". Rename the label instead, or wait until those requests roll off."
        )


def _validate_time_str(value: str, field: str) -> None:
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":":
        raise ValidationError(f"{field} must be HH:MM (24h).")
    try:
        h, m = int(value[0:2]), int(value[3:5])
    except ValueError:
        raise ValidationError(f"{field} must be HH:MM (24h).")
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValidationError(f"{field} must be HH:MM (24h).")
