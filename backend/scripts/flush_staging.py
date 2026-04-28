"""Full flush of the staging environment — every DynamoDB item, every Cognito user.

Stronger than wipe_neurostack_staging.py — that script only targets one org.
This one wipes the entire staging table and the entire staging Cognito pool,
leaving the infrastructure (table, pool, GSIs, app client, triggers) intact.

Use to land on an empty-but-functional staging.

Safety:
  - Hard-coded against staging table/pool names. Will refuse to run if either
    name does not contain "staging".
  - Default is --dry-run. --confirm required for any deletion.

Usage:
  python scripts/flush_staging.py --dry-run
  python scripts/flush_staging.py --confirm
"""
from __future__ import annotations

import argparse
import sys

import boto3
from botocore.exceptions import ClientError


DEFAULT_REGION = "ap-south-1"
DEFAULT_TABLE = "TaskManagementTable-staging"
DEFAULT_POOL_NAME = "TaskManagementUserPool-staging"


def scan_all_keys(table):
    """Yield (PK, SK) for every item in the table."""
    scan_kwargs = {"ProjectionExpression": "PK, SK"}
    while True:
        resp = table.scan(**scan_kwargs)
        for it in resp.get("Items", []):
            yield it["PK"], it["SK"]
        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def delete_ddb(table, pairs, dry_run):
    if dry_run:
        return len(pairs)
    count = 0
    with table.batch_writer() as batch:
        for pk, sk in pairs:
            batch.delete_item(Key={"PK": pk, "SK": sk})
            count += 1
    return count


def resolve_pool_id(cognito, pool_name):
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


def list_all_pool_users(cognito, pool_id):
    users = []
    pagination_token = None
    while True:
        kwargs = {"UserPoolId": pool_id, "Limit": 60}
        if pagination_token:
            kwargs["PaginationToken"] = pagination_token
        resp = cognito.list_users(**kwargs)
        for u in resp.get("Users", []):
            attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
            users.append({
                "username": u["Username"],
                "email": attrs.get("email", "(no-email)"),
                "sub": attrs.get("sub", ""),
            })
        pagination_token = resp.get("PaginationToken")
        if not pagination_token:
            break
    return users


def delete_cognito_users(cognito, pool_id, users, dry_run):
    if dry_run:
        return len(users)
    count = 0
    for user in users:
        try:
            cognito.admin_delete_user(UserPoolId=pool_id, Username=user["username"])
            count += 1
        except ClientError as e:
            print(f"  FAILED {user['email']}: {e.response['Error'].get('Message', e)}",
                  file=sys.stderr)
    return count


def parse_args():
    p = argparse.ArgumentParser(description="Flush ENTIRE staging table + pool.")
    p.add_argument("--table", default=DEFAULT_TABLE)
    p.add_argument("--pool-name", default=DEFAULT_POOL_NAME)
    p.add_argument("--region", default=DEFAULT_REGION)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--confirm", action="store_true",
                   help="REQUIRED for live execution")
    return p.parse_args()


def main():
    args = parse_args()
    if args.confirm:
        args.dry_run = False

    if "staging" not in args.table.lower() or "staging" not in args.pool_name.lower():
        print("REFUSING: table or pool name does not contain 'staging'.", file=sys.stderr)
        return 2

    session = boto3.Session(region_name=args.region)
    table = session.resource("dynamodb").Table(args.table)
    cognito = session.client("cognito-idp")

    print(f"=== flush_staging ({'DRY-RUN' if args.dry_run else 'LIVE'}) ===")
    print(f"  Region : {args.region}")
    print(f"  Table  : {args.table}")
    print(f"  Pool   : {args.pool_name}")
    print()

    pool_id = resolve_pool_id(cognito, args.pool_name)
    if pool_id is None:
        print(f"ERROR: pool {args.pool_name!r} not found", file=sys.stderr)
        return 2
    print(f"Pool id: {pool_id}")
    print()

    print("Listing ALL Cognito users in pool ...")
    users = list_all_pool_users(cognito, pool_id)
    print(f"  found {len(users)} users")
    print()

    print("Scanning ALL DynamoDB items ...")
    pairs = list(scan_all_keys(table))
    print(f"  found {len(pairs)} items")
    print()

    print(f"About to {'LIST (dry-run)' if args.dry_run else 'DELETE'}:")
    print(f"  DynamoDB items : {len(pairs)}")
    print(f"  Cognito users  : {len(users)}")
    print()

    if not args.dry_run and not args.confirm:
        print("ERROR: refusing to run without --confirm", file=sys.stderr)
        return 2

    ddb_n = delete_ddb(table, pairs, args.dry_run)
    cog_n = delete_cognito_users(cognito, pool_id, users, args.dry_run)

    verb = "would delete" if args.dry_run else "deleted"
    print(f"{verb} {ddb_n} DynamoDB items")
    print(f"{verb} {cog_n} Cognito users")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
