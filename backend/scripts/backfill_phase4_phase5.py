"""
Phase 4 + Phase 5 backfill — populates the role permission matrix and
seeds default task pipelines for an existing org.

This script complements `backfill_neurostack.py` (Phase 1). That script
seeded the three system role records with EMPTY permission lists because
Phase 4 hadn't shipped yet. Now that the permission matrix exists in
`contexts.org.domain.default_roles`, we need to populate it on the
already-seeded records. We also insert the four default pipelines that
Phase 5 expects every org to have (DEVELOPMENT/DESIGNING/MANAGEMENT/
RESEARCH) — the fresh-signup path writes these automatically; this
script catches up orgs that pre-date Phase 5.

Safety properties:
  - Idempotent — re-running is a no-op:
    * Roles: only writes permissions when the existing list is empty.
      An admin who has customized a role via /settings/roles is NOT
      overwritten.
    * Pipelines: writes only when the record doesn't exist (uses
      attribute_not_exists conditional put).
  - Dry-run flag prints what would change without touching the table.
  - Targets staging by default. Override --table for any other target.
  - Org-id parameterized so the same script can be run for any tenant
    that needs catching up, not just NEUROSTACK.

Usage:
  # Dry run against staging table for NEUROSTACK (the default):
  python scripts/backfill_phase4_phase5.py --dry-run

  # Apply changes:
  python scripts/backfill_phase4_phase5.py

  # Different org / table:
  python scripts/backfill_phase4_phase5.py --org acme --table TaskManagementTable-staging

DO NOT run against the prod table until staging is verified end-to-end.
See SAAS-MIGRATION.md for the full cutover sequence.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# Make the `src/` package importable when run from backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_BACKEND_DIR, "src"))

import boto3  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402

# Phase 4 + Phase 5 source-of-truth definitions live in the domain layer.
# Re-using them here means the script never drifts from what fresh
# signups produce — a future permission added in `default_roles.py`
# automatically gets backfilled by the next run of this script.
from contexts.org.domain.default_roles import (  # noqa: E402
    ADMIN_ROLE_ID,
    MEMBER_ROLE_ID,
    OWNER_ROLE_ID,
    default_permissions_for,
)
from contexts.org.domain.default_pipelines import build_default_pipelines  # noqa: E402


DEFAULT_ORG_ID = "neurostack"
DEFAULT_TABLE = os.environ.get(
    "DYNAMODB_TABLE_NAME", "TaskManagementTable-staging"
)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class BackfillStats:
    def __init__(self) -> None:
        # Roles
        self.roles_inspected = 0
        self.roles_populated = 0
        self.roles_already_populated = 0
        self.roles_missing = 0
        # Pipelines
        self.pipelines_inserted = 0
        self.pipelines_already_existed = 0
        # Errors
        self.errors: list[tuple[str, str]] = []

    def print_summary(self) -> None:
        print("\n--- Phase 4 + 5 backfill summary ---")
        print("Roles:")
        print(f"  inspected           : {self.roles_inspected}")
        print(f"  permissions written : {self.roles_populated}")
        print(f"  already populated   : {self.roles_already_populated}  (left alone — possibly admin-edited)")
        print(f"  missing record      : {self.roles_missing}  (Phase 1 backfill not yet run for this org)")
        print("Pipelines:")
        print(f"  inserted            : {self.pipelines_inserted}")
        print(f"  already existed     : {self.pipelines_already_existed}")
        if self.errors:
            print(f"\nERRORS ({len(self.errors)}):")
            for label, msg in self.errors[:20]:
                print(f"  {label}: {msg}")


# ---------------------------------------------------------------------------
# Role permission backfill
# ---------------------------------------------------------------------------

def _role_pk_sk(org_id: str, role_id: str) -> tuple[str, str]:
    return (f"ORG#{org_id}", f"ROLE#{role_id}")


def _decode_permissions(raw) -> list[str]:
    """Phase 1 stored permissions as a JSON-encoded string. New writes
    may store as a real list. Handle both shapes defensively."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return list(raw)
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
        except (ValueError, TypeError):
            return []
        return decoded if isinstance(decoded, list) else []
    return []


def backfill_role_permissions(table, org_id: str, dry_run: bool, stats: BackfillStats) -> None:
    """For each system role, fill in the Phase 4 permission matrix if
    the existing record has an empty permissions list."""
    now = datetime.now(timezone.utc).isoformat()
    for role_id in (OWNER_ROLE_ID, ADMIN_ROLE_ID, MEMBER_ROLE_ID):
        stats.roles_inspected += 1
        pk, sk = _role_pk_sk(org_id, role_id)

        try:
            resp = table.get_item(Key={"PK": pk, "SK": sk})
        except ClientError as e:
            stats.errors.append((f"role:{role_id}", str(e)))
            continue
        item = resp.get("Item")
        if not item:
            stats.roles_missing += 1
            print(f"  [skip ] role:{role_id} — record missing (run backfill_neurostack.py first)")
            continue

        existing_perms = _decode_permissions(item.get("permissions"))
        if existing_perms:
            stats.roles_already_populated += 1
            print(
                f"  [keep ] role:{role_id} — already has {len(existing_perms)} permission(s); not overwriting"
            )
            continue

        target_perms = default_permissions_for(role_id)
        if dry_run:
            stats.roles_populated += 1
            print(
                f"  [WOULD] role:{role_id} <- {len(target_perms)} permissions"
            )
            continue

        try:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET #p = :p, updated_at = :u",
                # `permissions` is a reserved-ish name on some DDB regions;
                # ExpressionAttributeNames keeps us safe across regions.
                ExpressionAttributeNames={"#p": "permissions"},
                # Defense in depth: only update when permissions is still
                # empty (or missing). Prevents a race with a concurrent
                # admin edit via /settings/roles between get_item above
                # and update_item here.
                ConditionExpression="attribute_not_exists(#p) OR #p = :empty",
                ExpressionAttributeValues={
                    ":p": json.dumps(target_perms),
                    ":u": now,
                    ":empty": json.dumps([]),
                },
            )
            stats.roles_populated += 1
            print(
                f"  [write] role:{role_id} <- {len(target_perms)} permissions"
            )
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code == "ConditionalCheckFailedException":
                # Someone edited it between our read and write — leave alone.
                stats.roles_already_populated += 1
                print(
                    f"  [race ] role:{role_id} — was edited concurrently; leaving as-is"
                )
            else:
                stats.errors.append((f"role:{role_id}", str(e)))


# ---------------------------------------------------------------------------
# Default pipeline insert
# ---------------------------------------------------------------------------

def _pipeline_pk_sk(org_id: str, pipeline_id: str) -> tuple[str, str]:
    return (f"ORG#{org_id}", f"PIPELINE#{pipeline_id}")


def backfill_default_pipelines(table, org_id: str, dry_run: bool, stats: BackfillStats) -> None:
    """Insert the four default pipelines if they don't already exist.

    Conditional put on PK+SK keeps this safe to re-run and safe against
    a tenant that has already created a pipeline with the same id (we
    leave their version alone)."""
    pipelines = build_default_pipelines(org_id)
    now = datetime.now(timezone.utc).isoformat()

    for p in pipelines:
        d = p.to_dict()
        pk, sk = _pipeline_pk_sk(org_id, d["pipeline_id"])
        item = {
            "PK": pk,
            "SK": sk,
            "org_id": org_id,
            "pipeline_id": d["pipeline_id"],
            "name": d["name"],
            "is_default": bool(d.get("is_default", False)),
            "statuses": json.dumps(d.get("statuses", [])),
            "created_at": d.get("created_at", now),
            "updated_at": d.get("updated_at", now),
        }

        if dry_run:
            stats.pipelines_inserted += 1
            print(
                f"  [WOULD] pipeline:{d['pipeline_id']} ({len(d.get('statuses', []))} statuses)"
            )
            continue

        try:
            table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
            )
            stats.pipelines_inserted += 1
            print(
                f"  [write] pipeline:{d['pipeline_id']} ({len(d.get('statuses', []))} statuses)"
            )
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code == "ConditionalCheckFailedException":
                stats.pipelines_already_existed += 1
                print(f"  [skip ] pipeline:{d['pipeline_id']} — already exists")
            else:
                stats.errors.append((f"pipeline:{d['pipeline_id']}", str(e)))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument(
        "--org",
        default=DEFAULT_ORG_ID,
        help=f"Org id to backfill (default: {DEFAULT_ORG_ID}).",
    )
    parser.add_argument(
        "--table",
        default=DEFAULT_TABLE,
        help=f"DynamoDB table name (default: {DEFAULT_TABLE}).",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "ap-south-1"),
        help="AWS region (default: ap-south-1, override via AWS_REGION).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions without modifying the table.",
    )
    parser.add_argument(
        "--skip-roles",
        action="store_true",
        help="Skip role permission backfill (only seed pipelines).",
    )
    parser.add_argument(
        "--skip-pipelines",
        action="store_true",
        help="Skip pipeline seeding (only populate role permissions).",
    )
    args = parser.parse_args()

    print("Phase 4 + Phase 5 backfill")
    print(f"  org    : {args.org}")
    print(f"  table  : {args.table}")
    print(f"  region : {args.region}")
    print(f"  mode   : {'DRY RUN' if args.dry_run else 'APPLY'}")
    print()

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    table = dynamodb.Table(args.table)

    stats = BackfillStats()

    if not args.skip_roles:
        print("Roles:")
        backfill_role_permissions(table, args.org, args.dry_run, stats)
        print()

    if not args.skip_pipelines:
        print("Pipelines:")
        backfill_default_pipelines(table, args.org, args.dry_run, stats)

    stats.print_summary()
    return 1 if stats.errors else 0


if __name__ == "__main__":
    sys.exit(main())
