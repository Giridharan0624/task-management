"""
Phase 1 Step 9 Cognito backfill — set `custom:orgId = neurostack` on every
existing user in the staging Cognito user pool.

Companion to `backfill_neurostack.py` (which handles DynamoDB). Together the
two scripts migrate every piece of state that needs an org_id: the DynamoDB
items via the first script, and the Cognito user attributes via this one.

Safety properties:
  - Idempotent: if `custom:orgId` is already set to the target value, the
    user is skipped. Re-running is a no-op.
  - Dry-run flag: prints what would be updated without calling Cognito.
  - Required `--user-pool-id` flag: no hardcoded default, so the script
    cannot accidentally target the wrong pool. You must explicitly pass
    the staging pool ID.
  - Safe to interrupt and resume.

Usage:
  # Against the staging pool (personal account, default profile):
  AWS_PROFILE=default python scripts/backfill_cognito.py \\
      --user-pool-id ap-south-1_XXXXXXXXX --dry-run

  AWS_PROFILE=default python scripts/backfill_cognito.py \\
      --user-pool-id ap-south-1_XXXXXXXXX

  # Smaller batches / louder progress logging:
  python scripts/backfill_cognito.py --user-pool-id ap-south-1_XXXXX --progress 20

DO NOT run this against the production pool until Phase 1 staging is fully
verified. See SAAS-MIGRATION.md for the cutover sequence.
"""
from __future__ import annotations

import argparse
import sys
from typing import Iterable

import boto3
from botocore.exceptions import ClientError


DEFAULT_ORG_ID = "neurostack"


class CognitoBackfillStats:
    def __init__(self) -> None:
        self.scanned = 0
        self.already_set = 0
        self.updated = 0
        self.errors: list[tuple[str, str]] = []

    def print_summary(self) -> None:
        print("\n--- Cognito backfill summary ---")
        print(f"Users scanned                  : {self.scanned}")
        print(f"Already had custom:orgId (skip): {self.already_set}")
        print(f"Updated (set custom:orgId)     : {self.updated}")
        if self.errors:
            print(f"ERRORS ({len(self.errors)}):")
            for username, err in self.errors[:20]:
                print(f"  {username}: {err}")


def iter_users(cognito, user_pool_id: str) -> Iterable[dict]:
    """Yield every user in the pool, handling pagination."""
    kwargs: dict = {"UserPoolId": user_pool_id, "Limit": 60}
    while True:
        response = cognito.list_users(**kwargs)
        for user in response.get("Users", []):
            yield user
        next_token = response.get("PaginationToken")
        if not next_token:
            break
        kwargs["PaginationToken"] = next_token


def get_attr(user: dict, name: str) -> str | None:
    for attr in user.get("Attributes", []):
        if attr.get("Name") == name:
            return attr.get("Value")
    return None


def run_backfill(
    user_pool_id: str,
    org_id: str,
    dry_run: bool,
    progress_interval: int,
) -> CognitoBackfillStats:
    cognito = boto3.client("cognito-idp")
    stats = CognitoBackfillStats()

    mode = "[DRY-RUN]" if dry_run else "[LIVE]"
    print(f"{mode} Target Cognito pool: {user_pool_id}")
    print(f"{mode} Setting custom:orgId = {org_id!r} on every user missing it")
    print()

    # Verify the pool exists and we have access before starting
    try:
        pool_info = cognito.describe_user_pool(UserPoolId=user_pool_id)
        print(f"Pool name: {pool_info['UserPool']['Name']}")
        print(f"Estimated users: {pool_info['UserPool'].get('EstimatedNumberOfUsers', '?')}")
    except ClientError as e:
        print(f"ERROR: cannot access pool {user_pool_id}: {e.response['Error']['Message']}")
        print("Check that --user-pool-id is correct and AWS_PROFILE points at the right account.")
        stats.errors.append((user_pool_id, str(e)))
        return stats
    print()

    for user in iter_users(cognito, user_pool_id):
        stats.scanned += 1
        username = user.get("Username", "")
        current = get_attr(user, "custom:orgId")

        if current == org_id:
            stats.already_set += 1
        else:
            if dry_run:
                label = "[DRY]"
                if current:
                    print(f"  {label} would overwrite custom:orgId={current!r} -> {org_id!r} for {username}")
                else:
                    print(f"  {label} would set custom:orgId={org_id!r} for {username}")
                stats.updated += 1
            else:
                try:
                    cognito.admin_update_user_attributes(
                        UserPoolId=user_pool_id,
                        Username=username,
                        UserAttributes=[{"Name": "custom:orgId", "Value": org_id}],
                    )
                    stats.updated += 1
                except ClientError as e:
                    stats.errors.append((username, e.response["Error"]["Message"]))

        if stats.scanned % progress_interval == 0:
            print(f"  scanned {stats.scanned} / updated {stats.updated} / skipped {stats.already_set}")

    stats.print_summary()
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Phase 1 Cognito backfill: set custom:orgId on every existing user."
    )
    parser.add_argument(
        "--user-pool-id",
        required=True,
        help="Cognito user pool ID (e.g. ap-south-1_XXXXXXXXX). REQUIRED — no default to prevent accidents.",
    )
    parser.add_argument("--org-id", default=DEFAULT_ORG_ID,
                        help=f"Target org_id value (default: {DEFAULT_ORG_ID})")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be updated without calling Cognito")
    parser.add_argument("--progress", type=int, default=50,
                        help="Print a progress line every N scanned users (default: 50)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    stats = run_backfill(
        user_pool_id=args.user_pool_id,
        org_id=args.org_id,
        dry_run=args.dry_run,
        progress_interval=args.progress,
    )
    return 1 if stats.errors else 0


if __name__ == "__main__":
    sys.exit(main())
