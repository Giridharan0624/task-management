"""
Phase 1 Step 9 backfill — rewrite every legacy item in the table as an
org-scoped copy keyed under `org_id = "neurostack"`. Also inserts the
top-level Organization / Settings / Plan / Role / Slug records that
make NEUROSTACK a real tenant.

Safety properties:
  - Idempotent: re-running is a no-op. Every PutItem uses
    `attribute_not_exists(PK) AND attribute_not_exists(SK)` so existing
    v2 items are never overwritten.
  - Non-destructive: legacy items are kept in place. Phase 1 Step 10
    flips reads; a later cleanup script deletes the legacy items after
    burn-in.
  - Dry-run flag: prints what would be written without touching the table.
  - Safe to interrupt: item classification is stateless and the next run
    picks up where the previous one left off.

Usage:
  # Against staging table (default):
  python scripts/backfill_neurostack.py --dry-run
  python scripts/backfill_neurostack.py

  # Against a different table:
  python scripts/backfill_neurostack.py --table TaskManagementTable-staging --dry-run

  # Show progress every N items:
  python scripts/backfill_neurostack.py --progress 500

This script is run manually via the staging AWS profile:
  AWS_PROFILE=company python scripts/backfill_neurostack.py --dry-run

DO NOT run against the prod table until the staging gate checklist is
fully green. See SAAS-MIGRATION.md for the full cutover sequence.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Iterable, Optional

# Make the `src/` package importable when run from backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_BACKEND_DIR, "src"))

import boto3  # noqa: E402
from boto3.dynamodb.conditions import Attr  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402


DEFAULT_ORG_ID = "neurostack"
DEFAULT_ORG_DISPLAY_NAME = "NEUROSTACK"
DEFAULT_SLUG = "neurostack"
DEFAULT_TABLE = os.environ.get("DYNAMODB_TABLE_NAME", "TaskManagementTable-staging")


# ---------------------------------------------------------------------------
# Key-rewrite primitives (PK/SK/GSI rewrites for every known legacy pattern)
# ---------------------------------------------------------------------------

def _org_prefix(org_id: str) -> str:
    return f"ORG#{org_id}#"


def _prefix_pk(pk: str, org_id: str) -> str:
    """Prepend ORG#{org_id}# to a legacy PK."""
    return _org_prefix(org_id) + pk


def classify_item(item: dict) -> Optional[str]:
    """Return a short tag describing the shape of a legacy item, or None
    if the item should be skipped (already-v2, org records, unknown)."""
    pk = item.get("PK", "")
    sk = item.get("SK", "")

    # Already org-scoped (v2) — skip
    if pk.startswith("ORG#") or pk.startswith("SLUG#"):
        return None

    if pk.startswith("USER#"):
        if sk == "PROFILE":
            return "user"
        if sk.startswith("ATTENDANCE#"):
            return "attendance"
        if sk.startswith("DAYOFF#"):
            return "dayoff"
        if sk.startswith("ACTIVITY#"):
            return "activity"
        if sk.startswith("SUMMARY#"):
            return "activity_summary"
        return "user_other"

    if pk.startswith("PROJECT#"):
        if sk == "METADATA":
            return "project"
        if sk.startswith("MEMBER#"):
            return "project_member"
        if sk.startswith("TASK#"):
            return "task"
        return "project_other"

    if pk.startswith("TASK#") and sk.startswith("COMMENT#"):
        return "comment"

    if pk.startswith("TASKUPDATE#") and sk.startswith("USER#"):
        return "taskupdate"

    return None


def transform_item(item: dict, kind: str, org_id: str) -> dict:
    """Clone the legacy item and rewrite its keys for the v2 schema.

    The transformation matches what each context's `to_dynamo_v2()` helper
    produces, but operates directly on the item dict so the backfill does
    not depend on domain-entity deserialization (which could fail on
    partially-populated rows).
    """
    new: dict = dict(item)
    new["org_id"] = org_id

    if kind == "user":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        # SK stays PROFILE
        # GSI1PK=USER_EMAIL#... stays global (Cognito-owned uniqueness)
        # GSI2PK=EMPLOYEE#... becomes org-scoped
        if item.get("GSI2PK", "").startswith("EMPLOYEE#"):
            new["GSI2PK"] = _prefix_pk(item["GSI2PK"], org_id)

    elif kind in ("attendance",):
        new["PK"] = _prefix_pk(item["PK"], org_id)
        if item.get("GSI1PK", "").startswith("ATTENDANCE_DATE#"):
            new["GSI1PK"] = _prefix_pk(item["GSI1PK"], org_id)

    elif kind == "dayoff":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        if item.get("GSI1PK", "").startswith("DAYOFF_ADMIN#"):
            new["GSI1PK"] = _prefix_pk(item["GSI1PK"], org_id)
        if item.get("GSI2PK", "").startswith("DAYOFF_LEAD#"):
            new["GSI2PK"] = _prefix_pk(item["GSI2PK"], org_id)

    elif kind == "activity":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        if item.get("GSI1PK", "").startswith("ACTIVITY_DATE#"):
            new["GSI1PK"] = _prefix_pk(item["GSI1PK"], org_id)

    elif kind == "activity_summary":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        # Summaries have no GSI

    elif kind == "project":
        new["PK"] = _prefix_pk(item["PK"], org_id)

    elif kind == "project_member":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        # GSI1PK is USER#{uid} (user-project index) -> org-scoped
        if item.get("GSI1PK", "").startswith("USER#"):
            new["GSI1PK"] = _prefix_pk(item["GSI1PK"], org_id)

    elif kind == "task":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        # GSI1PK is TASK#{tid} (task-by-id index) -> org-scoped
        if item.get("GSI1PK", "").startswith("TASK#"):
            new["GSI1PK"] = _prefix_pk(item["GSI1PK"], org_id)

    elif kind == "comment":
        new["PK"] = _prefix_pk(item["PK"], org_id)

    elif kind == "taskupdate":
        new["PK"] = _prefix_pk(item["PK"], org_id)
        # GSI1PK is USER#{uid} -> org-scoped
        if item.get("GSI1PK", "").startswith("USER#"):
            new["GSI1PK"] = _prefix_pk(item["GSI1PK"], org_id)

    else:
        raise ValueError(f"Unknown kind: {kind}")

    return new


# ---------------------------------------------------------------------------
# Top-level ORG/SETTINGS/PLAN/ROLE/SLUG seeding
# ---------------------------------------------------------------------------

def build_org_records(org_id: str, display_name: str, slug: str) -> list[dict]:
    """Records that make the tenant real. Written with attribute_not_exists
    so an existing org is not overwritten on re-run."""
    now = datetime.now(timezone.utc).isoformat()

    organization = {
        "PK": f"ORG#{org_id}",
        "SK": "ORG",
        "org_id": org_id,
        "slug": slug,
        "name": display_name,
        "owner_user_id": "",  # filled after cutover by an admin
        "status": "ACTIVE",
        "plan_tier": "ENTERPRISE",
        "created_at": now,
        "updated_at": now,
    }

    settings = {
        "PK": f"ORG#{org_id}",
        "SK": "SETTINGS",
        "org_id": org_id,
        "display_name": display_name,
        "primary_color": "#4F46E5",
        "accent_color": "#10B981",
        "terminology": json.dumps({}),
        "timezone": "Asia/Kolkata",
        "locale": "en-IN",
        "currency": "INR",
        "week_start_day": 1,
        "working_hours_start": "09:00",
        "working_hours_end": "18:00",
        "employee_id_prefix": "EMP-",
        "features": json.dumps({
            "birthday_wishes": True,
            "activity_monitoring": True,
            "screenshots": True,
            "ai_summaries": True,
            "day_offs": True,
            "comments": True,
            "task_updates": True,
        }),
        "leave_types": json.dumps([
            {"id": "casual", "name": "Casual", "annual_quota": 12},
            {"id": "sick", "name": "Sick", "annual_quota": 10},
            {"id": "earned", "name": "Earned", "annual_quota": 15},
        ]),
        "created_at": now,
        "updated_at": now,
    }

    plan = {
        "PK": f"ORG#{org_id}",
        "SK": "PLAN",
        "org_id": org_id,
        "tier": "ENTERPRISE",
        "max_users": None,
        "max_projects": None,
        "retention_days": None,
        "features_allowed": json.dumps(sorted({
            "birthday_wishes", "activity_monitoring", "screenshots",
            "ai_summaries", "day_offs", "comments", "task_updates",
            "custom_pipelines", "custom_roles", "api_access",
            "sso", "audit_logs", "white_label", "custom_domain",
        })),
        "created_at": now,
        "updated_at": now,
    }

    role_owner = _role_record(org_id, "owner", "Owner", is_system=True, now=now)
    role_admin = _role_record(org_id, "admin", "Admin", is_system=True, now=now)
    role_member = _role_record(org_id, "member", "Member", is_system=True, now=now)

    slug_record = {
        "PK": f"SLUG#{slug}",
        "SK": "ORG",
        "slug": slug,
        "org_id": org_id,
        "created_at": now,
    }

    return [organization, settings, plan, role_owner, role_admin, role_member, slug_record]


def _role_record(org_id: str, role_id: str, name: str, is_system: bool, now: str) -> dict:
    return {
        "PK": f"ORG#{org_id}",
        "SK": f"ROLE#{role_id}",
        "org_id": org_id,
        "role_id": role_id,
        "name": name,
        "scope": "system",
        "is_system": is_system,
        # Permissions are seeded empty here; Phase 4 fills in the matrix.
        "permissions": json.dumps([]),
        "created_at": now,
        "updated_at": now,
    }


# ---------------------------------------------------------------------------
# Backfill driver
# ---------------------------------------------------------------------------

class BackfillStats:
    def __init__(self) -> None:
        self.scanned = 0
        self.skipped_v2 = 0
        self.skipped_unknown = 0
        self.written = 0
        self.already_existed = 0
        self.by_kind: dict[str, int] = {}
        self.errors: list[tuple[str, str]] = []

    def record_write(self, kind: str) -> None:
        self.written += 1
        self.by_kind[kind] = self.by_kind.get(kind, 0) + 1

    def print_summary(self) -> None:
        print("\n--- Backfill summary ---")
        print(f"Scanned total items         : {self.scanned}")
        print(f"Already in v2 format (skip) : {self.skipped_v2}")
        print(f"Unknown PK/SK shape (skip)  : {self.skipped_unknown}")
        print(f"Already existed (idempotent): {self.already_existed}")
        print(f"New v2 items written        : {self.written}")
        if self.by_kind:
            print("By kind:")
            for kind, count in sorted(self.by_kind.items()):
                print(f"  {kind:<18}: {count}")
        if self.errors:
            print(f"ERRORS ({len(self.errors)}):")
            for pk_sk, err in self.errors[:20]:
                print(f"  {pk_sk}: {err}")


def scan_all_items(table) -> Iterable[dict]:
    """Stream every item in the table (paginated)."""
    response = table.scan()
    for it in response.get("Items", []):
        yield it
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        for it in response.get("Items", []):
            yield it


def put_new_only(table, item: dict, dry_run: bool) -> str:
    """Write `item` only if PK+SK don't already exist.

    Returns one of: 'wrote', 'existed', 'error:<msg>'.
    """
    if dry_run:
        return "wrote"  # pretend
    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
        )
        return "wrote"
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return "existed"
        return f"error:{e.response['Error']['Code']}: {e.response['Error'].get('Message', '')}"


def run_backfill(
    table_name: str,
    org_id: str,
    display_name: str,
    slug: str,
    dry_run: bool,
    progress_interval: int,
) -> BackfillStats:
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    mode_banner = "[DRY-RUN]" if dry_run else "[LIVE]"
    print(f"{mode_banner} Backfill target table: {table_name}")
    print(f"{mode_banner} Target org_id: {org_id} (slug={slug}, display={display_name})")
    print()

    stats = BackfillStats()

    # Step A: seed org-level records first so any downstream queries find a tenant.
    print("--- Step A: seed org-level records ---")
    for rec in build_org_records(org_id, display_name, slug):
        pk_sk = f"{rec['PK']} / {rec['SK']}"
        if dry_run:
            print(f"  [DRY] would write {pk_sk}")
            stats.record_write(f"org:{rec['SK']}")
            continue
        result = put_new_only(table, rec, dry_run=False)
        if result == "wrote":
            print(f"  wrote {pk_sk}")
            stats.record_write(f"org:{rec['SK']}")
        elif result == "existed":
            print(f"  exists {pk_sk} (skip)")
            stats.already_existed += 1
        else:
            print(f"  ERROR {pk_sk}: {result}")
            stats.errors.append((pk_sk, result))

    # Step B: walk the table and rewrite every legacy item into its v2 copy.
    print("\n--- Step B: rewrite legacy items ---")
    for item in scan_all_items(table):
        stats.scanned += 1
        if stats.scanned % progress_interval == 0:
            print(f"  scanned {stats.scanned} items ({stats.written} written)")

        kind = classify_item(item)
        if kind is None:
            if item.get("PK", "").startswith(("ORG#", "SLUG#")):
                stats.skipped_v2 += 1
            else:
                stats.skipped_unknown += 1
            continue

        try:
            v2_item = transform_item(item, kind, org_id)
        except Exception as e:  # pragma: no cover
            stats.errors.append((f"{item.get('PK')}/{item.get('SK')}", f"transform: {e}"))
            continue

        pk_sk = f"{v2_item['PK']} / {v2_item['SK']}"
        if dry_run:
            stats.record_write(kind)
            continue

        result = put_new_only(table, v2_item, dry_run=False)
        if result == "wrote":
            stats.record_write(kind)
        elif result == "existed":
            stats.already_existed += 1
        else:
            stats.errors.append((pk_sk, result))

    stats.print_summary()
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 1 backfill: rewrite NEUROSTACK data as org-scoped v2 items.")
    parser.add_argument("--table", default=DEFAULT_TABLE,
                        help=f"DynamoDB table name (default: {DEFAULT_TABLE})")
    parser.add_argument("--org-id", default=DEFAULT_ORG_ID,
                        help=f"Target org_id (default: {DEFAULT_ORG_ID})")
    parser.add_argument("--display-name", default=DEFAULT_ORG_DISPLAY_NAME,
                        help=f"Organization display name (default: {DEFAULT_ORG_DISPLAY_NAME})")
    parser.add_argument("--slug", default=DEFAULT_SLUG,
                        help=f"Workspace-code slug (default: {DEFAULT_SLUG})")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be written without touching the table")
    parser.add_argument("--progress", type=int, default=200,
                        help="Print a progress line every N scanned items (default: 200)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    stats = run_backfill(
        table_name=args.table,
        org_id=args.org_id,
        display_name=args.display_name,
        slug=args.slug,
        dry_run=args.dry_run,
        progress_interval=args.progress,
    )
    return 1 if stats.errors else 0


if __name__ == "__main__":
    sys.exit(main())
