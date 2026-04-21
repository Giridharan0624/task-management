"""Wipe every item scoped to the `neurostack` org on STAGING — DynamoDB + Cognito.

Pairs with seed_neurostack_staging.py: run this first to land on a blank slate,
then run the seeder to populate demo data.

Safety properties:
  - Explicit --confirm required for any deletion; default is --dry-run.
  - Hard-coded against staging table/pool names. Prod profile/table not
    reachable without editing this file on purpose.
  - Scans the table looking for PK patterns that belong to `ORG#neurostack`,
    then batches deletes. Other orgs' data is untouched.

Usage:
  # personal AWS profile (staging)
  python scripts/wipe_neurostack_staging.py --dry-run
  python scripts/wipe_neurostack_staging.py --confirm
"""
from __future__ import annotations

import argparse
import sys
from typing import Iterable

import boto3
from botocore.exceptions import ClientError


DEFAULT_REGION = "ap-south-1"
DEFAULT_TABLE = "TaskManagementTable-staging"
DEFAULT_POOL_NAME = "TaskManagementUserPool-staging"
TARGET_ORG = "neurostack"
TARGET_SLUG = "neurostack"


def scan_org_items(table, org_id: str, slug: str) -> Iterable[tuple[str, str, str]]:
    """Yield (PK, SK, org_id_on_item) for every item belonging to the target org.

    Captures:
      - PK == ORG#{org_id}               (org/settings/plan/role/pipeline/invite)
      - PK startswith ORG#{org_id}#      (users, projects, tasks, etc.)
      - PK == SLUG#{slug}                (the slug resolver record)
      - PK startswith INVITE_TOKEN# AND org_id attr == target   (global lookup)
    """
    org_pk = f"ORG#{org_id}"
    org_pk_prefix = f"ORG#{org_id}#"
    slug_pk = f"SLUG#{slug}"

    scan_kwargs = {
        "ProjectionExpression": "PK, SK, org_id",
    }
    while True:
        resp = table.scan(**scan_kwargs)
        for it in resp.get("Items", []):
            pk = it.get("PK", "")
            sk = it.get("SK", "")
            org_attr = it.get("org_id", "")
            if pk == org_pk:
                yield pk, sk, org_attr
            elif pk.startswith(org_pk_prefix):
                yield pk, sk, org_attr
            elif pk == slug_pk:
                yield pk, sk, org_attr
            elif pk.startswith("INVITE_TOKEN#") and org_attr == org_id:
                yield pk, sk, org_attr
        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def delete_ddb_items(table, pairs: list[tuple[str, str]], dry_run: bool) -> int:
    if dry_run:
        return len(pairs)
    count = 0
    with table.batch_writer() as batch:
        for pk, sk in pairs:
            batch.delete_item(Key={"PK": pk, "SK": sk})
            count += 1
    return count


def resolve_pool_id(cognito, pool_name: str) -> str | None:
    next_token = None
    while True:
        kwargs = {"MaxResults": 60}
        if next_token:
            kwargs["NextToken"] = next_token
        resp = cognito.list_user_pools(**kwargs)
        for p in resp.get("UserPools", []):
            if p["Name"] == pool_name:
                return p["Id"]
        next_token = resp.get("NextToken")
        if not next_token:
            break
    return None


def list_cognito_users_in_org(cognito, pool_id: str, org_id: str) -> list[dict]:
    """Cognito doesn't support filtering by custom attrs server-side; list all
    and match client-side on custom:orgId."""
    users: list[dict] = []
    pagination_token = None
    while True:
        kwargs = {"UserPoolId": pool_id, "Limit": 60}
        if pagination_token:
            kwargs["PaginationToken"] = pagination_token
        resp = cognito.list_users(**kwargs)
        for u in resp.get("Users", []):
            attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
            if attrs.get("custom:orgId") == org_id:
                users.append({
                    "username": u["Username"],
                    "email": attrs.get("email", "(no-email)"),
                    "sub": attrs.get("sub", ""),
                })
        pagination_token = resp.get("PaginationToken")
        if not pagination_token:
            break
    return users


def delete_cognito_users(cognito, pool_id: str, users: list[dict], dry_run: bool) -> int:
    if dry_run:
        return len(users)
    count = 0
    for user in users:
        try:
            cognito.admin_delete_user(UserPoolId=pool_id, Username=user["username"])
            count += 1
        except ClientError as e:
            print(f"  FAILED to delete {user['email']}: {e.response['Error'].get('Message', e)}",
                  file=sys.stderr)
    return count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Wipe all neurostack-org data on staging (DynamoDB + Cognito)."
    )
    parser.add_argument("--table", default=DEFAULT_TABLE, help=f"default: {DEFAULT_TABLE}")
    parser.add_argument("--pool-name", default=DEFAULT_POOL_NAME, help=f"default: {DEFAULT_POOL_NAME}")
    parser.add_argument("--region", default=DEFAULT_REGION, help=f"default: {DEFAULT_REGION}")
    parser.add_argument("--org-id", default=TARGET_ORG, help=f"default: {TARGET_ORG}")
    parser.add_argument("--slug", default=TARGET_SLUG, help=f"default: {TARGET_SLUG}")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="print what would be deleted without touching anything (default ON)")
    parser.add_argument("--confirm", action="store_true",
                        help="REQUIRED to actually delete; disables --dry-run")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.confirm:
        args.dry_run = False

    session = boto3.Session(region_name=args.region)
    ddb = session.resource("dynamodb")
    table = ddb.Table(args.table)
    cognito = session.client("cognito-idp")

    print(f"=== wipe_neurostack_staging ({'DRY-RUN' if args.dry_run else 'LIVE'}) ===")
    print(f"  Region     : {args.region}")
    print(f"  Table      : {args.table}")
    print(f"  Pool       : {args.pool_name}")
    print(f"  Org        : {args.org_id}")
    print(f"  Slug       : {args.slug}")
    print()

    print("Resolving Cognito pool id ...")
    pool_id = resolve_pool_id(cognito, args.pool_name)
    if pool_id is None:
        print(f"  ERROR: pool {args.pool_name!r} not found in {args.region}", file=sys.stderr)
        return 2
    print(f"  pool id: {pool_id}")
    print()

    print("Listing Cognito users with custom:orgId == target ...")
    cog_users = list_cognito_users_in_org(cognito, pool_id, args.org_id)
    print(f"  found {len(cog_users)} users")
    if cog_users and args.dry_run:
        for u in cog_users[:5]:
            print(f"    - {u['email']}  sub={u['sub'][:8]}...")
        if len(cog_users) > 5:
            print(f"    ... (+ {len(cog_users) - 5} more)")
    print()

    print("Scanning DynamoDB for org-scoped items ...")
    triples = list(scan_org_items(table, args.org_id, args.slug))
    print(f"  found {len(triples)} items")

    # Sample breakdown for visibility
    breakdown: dict[str, int] = {}
    for pk, sk, _ in triples:
        if pk.startswith("SLUG#"):
            key = "slug"
        elif pk == f"ORG#{args.org_id}":
            # org/settings/plan/role/pipeline/invite
            if sk == "ORG":
                key = "org"
            elif sk == "SETTINGS":
                key = "settings"
            elif sk == "PLAN":
                key = "plan"
            elif sk.startswith("ROLE#"):
                key = "role"
            elif sk.startswith("PIPELINE#"):
                key = "pipeline"
            elif sk.startswith("INVITE#"):
                key = "invite"
            else:
                key = "org_other"
        elif pk.startswith("INVITE_TOKEN#"):
            key = "invite_token_lookup"
        elif "#USER#" in pk:
            if sk == "PROFILE":
                key = "user_profile"
            elif sk.startswith("ATTENDANCE#"):
                key = "attendance"
            elif sk.startswith("DAYOFF#"):
                key = "dayoff"
            elif sk.startswith("ACTIVITY#"):
                key = "activity"
            elif sk.startswith("SUMMARY#"):
                key = "activity_summary"
            else:
                key = "user_other"
        elif "#PROJECT#" in pk:
            if sk == "METADATA":
                key = "project"
            elif sk.startswith("MEMBER#"):
                key = "project_member"
            elif sk.startswith("TASK#"):
                key = "task"
            else:
                key = "project_other"
        elif "#TASK#" in pk:
            key = "comment"
        elif "#TASKUPDATE#" in pk:
            key = "taskupdate"
        else:
            key = "other"
        breakdown[key] = breakdown.get(key, 0) + 1

    for k in sorted(breakdown):
        print(f"    {k:<22}: {breakdown[k]}")
    print()

    pairs = [(pk, sk) for pk, sk, _ in triples]

    print(f"About to {'LIST (dry-run)' if args.dry_run else 'DELETE'}:")
    print(f"  DynamoDB items : {len(pairs)}")
    print(f"  Cognito users  : {len(cog_users)}")
    print()

    if not args.dry_run and not args.confirm:
        print("ERROR: refusing to run without --confirm", file=sys.stderr)
        return 2

    deleted_ddb = delete_ddb_items(table, pairs, args.dry_run)
    deleted_cog = delete_cognito_users(cognito, pool_id, cog_users, args.dry_run)

    verb = "would delete" if args.dry_run else "deleted"
    print(f"{verb} {deleted_ddb} DynamoDB items")
    print(f"{verb} {deleted_cog} Cognito users")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
