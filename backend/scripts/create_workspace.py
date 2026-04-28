"""Create a single fresh workspace on STAGING — one org, one Owner user.

Reuses the builder helpers from seed_neurostack_staging.py so the org-level
records (Org / Settings / Plan / Roles / Pipelines / Slug) are identical to
what a real signup would produce.

Usage:
  python scripts/create_workspace.py --email taskflow@neurostack.demo \\
      --password Demo1234! --confirm
"""
from __future__ import annotations

import argparse
import os
import sys

import boto3

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from seed_neurostack_staging import (  # type: ignore
    build_org_level_items,
    build_role_items,
    build_pipeline_items,
    build_user_item,
    create_cognito_user,
    resolve_pool_id,
    iso_now,
)


DEFAULT_REGION = "ap-south-1"
DEFAULT_TABLE = "TaskManagementTable-staging"
DEFAULT_POOL_NAME = "TaskManagementUserPool-staging"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", default="neurostack")
    parser.add_argument("--slug", default="neurostack")
    parser.add_argument("--display-name", default="NEUROSTACK")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--owner-name", default="TaskFlow Admin")
    parser.add_argument("--employee-id", default="EMP-001")
    parser.add_argument("--table", default=DEFAULT_TABLE)
    parser.add_argument("--pool-name", default=DEFAULT_POOL_NAME)
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()
    if args.confirm:
        args.dry_run = False

    if "staging" not in args.table.lower() or "staging" not in args.pool_name.lower():
        print("REFUSING: table or pool name does not contain 'staging'.", file=sys.stderr)
        return 2

    session = boto3.Session(region_name=args.region)
    table = session.resource("dynamodb").Table(args.table)
    cognito = session.client("cognito-idp")

    pool_id = resolve_pool_id(cognito, args.pool_name)
    if pool_id is None:
        print(f"ERROR: pool {args.pool_name!r} not found", file=sys.stderr)
        return 2

    print(f"=== create_workspace ({'DRY-RUN' if args.dry_run else 'LIVE'}) ===")
    print(f"  Org id        : {args.org_id}")
    print(f"  Slug          : {args.slug}")
    print(f"  Display name  : {args.display_name}")
    print(f"  Owner email   : {args.email}")
    print(f"  Owner name    : {args.owner_name}")
    print(f"  Employee id   : {args.employee_id}")
    print(f"  Pool id       : {pool_id}")
    print()

    if args.dry_run:
        print("Would create:")
        print("  - 1 Cognito user (OWNER, permanent password)")
        print("  - 1 user profile (DynamoDB)")
        print("  - 4 org-level records (Org, Settings, Plan, Slug)")
        print("  - 3 system roles (Owner, Admin, Member)")
        print("  - 4 default pipelines (DEVELOPMENT, DESIGNING, MANAGEMENT, RESEARCH)")
        print()
        print("Re-run with --confirm to execute.")
        return 0

    print("Creating Cognito user ...")
    user_id = create_cognito_user(
        cognito, pool_id, args.email, args.owner_name,
        system_role="OWNER", org_id=args.org_id,
        employee_id=args.employee_id, password=args.password,
    )
    print(f"  sub: {user_id}")
    print()

    print("Building org-level + role + pipeline + user items ...")
    now = iso_now()
    items: list[dict] = []
    items.extend(build_org_level_items(args.org_id, args.slug, args.display_name, user_id, now))
    items.extend(build_role_items(args.org_id, now))
    items.extend(build_pipeline_items(args.org_id, now))
    items.append(build_user_item(
        org_id=args.org_id, user_id=user_id,
        employee_id=args.employee_id, email=args.email,
        name=args.owner_name, system_role="OWNER",
        designation="Owner", department="Executive",
        dob_month=1, dob_day=1, created_by=None, now=now,
    ))
    print(f"  {len(items)} items prepared")
    print()

    print("Writing to DynamoDB ...")
    with table.batch_writer() as batch:
        for it in items:
            batch.put_item(Item=it)
    print(f"  wrote {len(items)} items")
    print()

    print("=== Workspace ready ===")
    print(f"  Workspace code : {args.slug}")
    print(f"  Email          : {args.email}")
    print(f"  Password       : {args.password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
