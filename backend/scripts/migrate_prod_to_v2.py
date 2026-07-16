#!/usr/bin/env python3
"""
One-time migration: legacy prod -> taskflow-v2.

Source: `TaskFlowTable` (legacy SINGLE-TENANT schema) + Cognito pool
        ap-south-1_KvHp1RVEE + bucket taskflow-ns-uploads-prod
Target: `TaskFlowTable-v2` (multi-tenant schema) + Cognito pool
        ap-south-1_yWxQYrYXp + bucket taskflow-ns-uploads-v2-prod

See docs/planning/PROD-TO-V2-MIGRATION-PLAN.md for the full plan.

PROD IS READ-ONLY. This script only scans/lists/gets/copies FROM prod; it
never writes to the prod table, pool, or bucket.

Steps (run in order):

  python scripts/migrate_prod_to_v2.py cognito --dry-run   # -> sub_map.json
  python scripts/migrate_prod_to_v2.py cognito
  python scripts/migrate_prod_to_v2.py data    --dry-run
  python scripts/migrate_prod_to_v2.py data
  python scripts/migrate_prod_to_v2.py s3      --dry-run
  python scripts/migrate_prod_to_v2.py s3
  python scripts/migrate_prod_to_v2.py verify

Design notes
------------
* Items are read/written with the LOW-LEVEL client, so DynamoDB type
  descriptors ({"S":...},{"N":...}) are preserved verbatim — lossless.
* Sub remapping is done as a blanket string replace over the item's JSON
  representation. Subs are UUID-shaped and globally unique, so this
  catches every reference at once: PK/SK/GSI keys, plain attributes
  (`created_by`, `user_id`, `owner_user_id`), list attributes
  (`assigned_to`), AND subs embedded inside serialized JSON blobs (e.g.
  an ACTIVITY item's `buckets` string, which contains screenshot URLs).
  Doing it structurally field-by-field would miss the nested blobs.
* Screenshot URLs are rewritten AFTER sub replacement, so the sub in the
  URL is already the new one and only the host+prefix need fixing.
* Every PutItem is conditional (attribute_not_exists) => idempotent, safe
  to re-run / resume.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.types import TypeSerializer

# Reuse the REAL domain builders so a migrated org is byte-identical to one
# produced by the signup path (correct permission matrices, role scopes, and
# pipeline statuses). Hand-rolling these is how you get status-less pipelines
# and empty permission lists.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "src"))
from contexts.org.application.create_organization import (  # noqa: E402
    _project_role_record, _role_record,
)
from contexts.org.domain.default_pipelines import build_default_pipelines  # noqa: E402
from contexts.org.domain.default_project_roles import (  # noqa: E402
    DEFAULT_PROJECT_ROLE_IDS, PROJECT_ROLE_DISPLAY_NAMES,
)
from contexts.org.domain.default_roles import (  # noqa: E402
    ADMIN_ROLE_ID, MEMBER_ROLE_ID, OWNER_ROLE_ID,
)
from contexts.org.domain.entities import Organization, OrgSettings  # noqa: E402
from contexts.org.domain.value_objects import OrgStatus  # noqa: E402
from contexts.org.domain.plans import plan_from_template  # noqa: E402
from contexts.org.domain.value_objects import PlanTier  # noqa: E402
from contexts.org.infrastructure.mapper import OrgMapper  # noqa: E402

_ser = TypeSerializer()


def to_ddb(plain: dict) -> dict:
    """Plain python dict -> raw DynamoDB item, dropping None values (the
    mapper omits unset plan limits, which is how 'unlimited' is encoded)."""
    return {k: _ser.serialize(v) for k, v in plain.items() if v is not None}

# ---------------------------------------------------------------------------
# Configuration — verified 2026-07-09
# ---------------------------------------------------------------------------
PROFILE = os.environ.get("AWS_PROFILE", "company")
REGION = "ap-south-1"

SRC_TABLE = "TaskFlowTable"
DST_TABLE = "TaskFlowTable-v2"
SRC_POOL = "ap-south-1_KvHp1RVEE"
DST_POOL = "ap-south-1_yWxQYrYXp"
SRC_BUCKET = "taskflow-ns-uploads-prod"
DST_BUCKET = "taskflow-ns-uploads-v2-prod"

SRC_CDN = "dp2uotzxlo5a5.cloudfront.net"
DST_CDN = "d2fo333r5g6kfp.cloudfront.net"

ORG_ID = "neurostack"
ORG_DISPLAY_NAME = "NEUROSTACK"
ORG_SLUG = "neurostack"

# Upload-type prefixes, per upload/handlers/presign.py UPLOAD_TYPES. v2 keys
# every object as `orgs/{org}/{prefix}/{user}/{uuid}`; legacy prod had no org
# segment. Anything else in the source bucket (e.g. `releases/`) is NOT user
# data and is deliberately not migrated.
UPLOAD_PREFIXES = ("screenshots", "avatars", "attachments")

HERE = os.path.dirname(os.path.abspath(__file__))
SUB_MAP_PATH = os.path.join(HERE, "sub_map.json")

_sess = boto3.Session(profile_name=PROFILE, region_name=REGION)
ddb = _sess.client("dynamodb")
cog = _sess.client("cognito-idp")
s3 = _sess.client("s3")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def scan_all(table: str) -> list[dict]:
    items, kw = [], {"TableName": table}
    while True:
        r = ddb.scan(**kw)
        items += r["Items"]
        if "LastEvaluatedKey" not in r:
            return items
        kw["ExclusiveStartKey"] = r["LastEvaluatedKey"]


def s(item: dict, key: str) -> str:
    """Read a string attribute out of a raw DynamoDB item."""
    return item.get(key, {}).get("S", "")


def load_sub_map() -> dict[str, str]:
    if not os.path.exists(SUB_MAP_PATH):
        sys.exit(f"ERROR: {SUB_MAP_PATH} missing — run the `cognito` step first.")
    return json.load(open(SUB_MAP_PATH))


def put_new(table: str, item: dict, dry: bool) -> bool:
    """Conditional put => idempotent. Returns True if written."""
    if dry:
        return True
    try:
        ddb.put_item(
            TableName=table,
            Item=item,
            ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False  # already migrated
        raise


# ---------------------------------------------------------------------------
# Step 1 — Cognito: mirror prod users into v2, emit sub_map.json
# ---------------------------------------------------------------------------

def step_cognito(dry: bool) -> None:
    users, kw = [], {"UserPoolId": SRC_POOL}
    while True:
        r = cog.list_users(**kw)
        users += r["Users"]
        if "PaginationToken" not in r:
            break
        kw["PaginationToken"] = r["PaginationToken"]

    # Legacy PROFILEs carry the authoritative system_role.
    roles: dict[str, str] = {}
    for it in scan_all(SRC_TABLE):
        if s(it, "SK") == "PROFILE" and s(it, "PK").startswith("USER#"):
            roles[s(it, "PK")[len("USER#"):]] = s(it, "system_role") or "MEMBER"

    sub_map: dict[str, str] = {}
    for u in users:
        old_sub = u["Username"]
        attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
        # Lowercase-normalize: prod holds mixed-case addresses which would
        # otherwise produce duplicate USER_EMAIL# GSI keys in v2.
        email = attrs.get("email", "").strip().lower()
        if not email:
            print(f"  SKIP {old_sub}: no email")
            continue

        create_attrs = [
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "custom:orgId", "Value": ORG_ID},
            {"Name": "custom:systemRole", "Value": roles.get(old_sub, "MEMBER")},
        ]
        if attrs.get("name"):
            create_attrs.append({"Name": "name", "Value": attrs["name"]})

        if dry:
            print(f"  WOULD CREATE {email:45} role={roles.get(old_sub,'MEMBER')}")
            sub_map[old_sub] = f"<new-sub-for:{email}>"
            continue

        try:
            resp = cog.admin_create_user(
                UserPoolId=DST_POOL,
                Username=email,
                UserAttributes=create_attrs,
                MessageAction="SUPPRESS",  # migration trigger handles first login
            )
            new_sub = next(a["Value"] for a in resp["User"]["Attributes"] if a["Name"] == "sub")
        except cog.exceptions.UsernameExistsException:
            got = cog.admin_get_user(UserPoolId=DST_POOL, Username=email)
            new_sub = next(a["Value"] for a in got["UserAttributes"] if a["Name"] == "sub")
            print(f"  EXISTS  {email:45} -> reusing {new_sub}")
        sub_map[old_sub] = new_sub
        print(f"  {old_sub}  ->  {new_sub}   {email}")

    if not dry:
        json.dump(sub_map, open(SUB_MAP_PATH, "w"), indent=1)
        print(f"\nwrote {SUB_MAP_PATH} ({len(sub_map)} users)")
    else:
        print(f"\n[dry-run] {len(sub_map)} users would be created")


# ---------------------------------------------------------------------------
# Step 2 — DynamoDB: classify -> org-scope -> sub-remap -> URL-rewrite -> load
# ---------------------------------------------------------------------------

def classify(item: dict) -> Optional[str]:
    """Mirrors backfill_neurostack.classify_item, on the raw item format."""
    pk, sk = s(item, "PK"), s(item, "SK")
    if pk.startswith("ORG#") or pk.startswith("SLUG#"):
        return None  # already v2
    if pk.startswith("USER#"):
        if sk == "PROFILE":
            return "user"
        for p, k in (("ATTENDANCE#", "attendance"), ("DAYOFF#", "dayoff"),
                     ("ACTIVITY#", "activity"), ("SUMMARY#", "activity_summary")):
            if sk.startswith(p):
                return k
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


# GSI keys that must become org-scoped, by item kind.
_GSI_PREFIXES = {
    "user": [("GSI2PK", "EMPLOYEE#")],
    "attendance": [("GSI1PK", "ATTENDANCE_DATE#")],
    "dayoff": [("GSI1PK", "DAYOFF_ADMIN#"), ("GSI2PK", "DAYOFF_LEAD#")],
    "activity": [("GSI1PK", "ACTIVITY_DATE#")],
    "project_member": [("GSI1PK", "USER#")],
    "task": [("GSI1PK", "TASK#")],
    "taskupdate": [("GSI1PK", "USER#")],
}


def transform(item: dict, kind: str) -> dict:
    """Org-scope the keys. GSI1PK=USER_EMAIL# stays global (Cognito-owned)."""
    new = dict(item)
    new["org_id"] = {"S": ORG_ID}
    new["PK"] = {"S": f"ORG#{ORG_ID}#" + s(item, "PK")}
    for attr, prefix in _GSI_PREFIXES.get(kind, []):
        if s(item, attr).startswith(prefix):
            new[attr] = {"S": f"ORG#{ORG_ID}#" + s(item, attr)}
    return new


def remap(item: dict, sub_map: dict[str, str]) -> dict:
    """Blanket sub replace + screenshot URL rewrite over the item's JSON.

    Safe because the raw DynamoDB representation is pure JSON strings and
    subs are globally-unique UUIDs. Catches nested blobs (ACTIVITY.buckets)
    that a field-by-field rewrite would miss.
    """
    blob = json.dumps(item)
    for old, new in sub_map.items():
        blob = blob.replace(old, new)
    # After sub replacement the URL already carries the NEW sub; only the
    # host + org prefix need fixing. v2 keys every upload as
    # `orgs/{org}/{prefix}/{user}/{uuid}` (see upload/handlers/presign.py),
    # whereas legacy prod had no org segment:
    #   {SRC_CDN}/{prefix}/{sub}/f -> {DST_CDN}/orgs/{org}/{prefix}/{sub}/f
    for prefix in UPLOAD_PREFIXES:
        blob = blob.replace(f"{SRC_CDN}/{prefix}/", f"{DST_CDN}/orgs/{ORG_ID}/{prefix}/")
    blob = blob.replace(SRC_CDN, DST_CDN)  # any other legacy CDN reference
    return json.loads(blob)


def _pipeline_record(org_id: str, pipeline, now: str) -> dict:
    """Mirror OrgDynamoRepository.save_pipeline's item shape (statuses are
    stored as a JSON string; the flag is `is_default`, not `is_system`)."""
    p = pipeline.model_dump()
    return {
        "PK": f"ORG#{org_id}", "SK": f"PIPELINE#{p['pipeline_id']}",
        "org_id": org_id, "pipeline_id": p["pipeline_id"], "name": p["name"],
        "is_default": bool(p.get("is_default", False)),
        "statuses": json.dumps(p.get("statuses", [])),
        "created_at": p.get("created_at", now), "updated_at": p.get("updated_at", now),
    }


def build_org_records() -> list[dict]:
    """Org scaffolding built from the SAME domain builders/mappers the signup
    path uses, so a migrated tenant is indistinguishable from a freshly
    signed-up one:

      * 3 system roles  (owner/admin/member)        — permission matrix filled
      * 4 project roles (project_admin/project_manager/team_lead/
        project_member)  scope='project'            — permission matrix filled
      * 4 default pipelines — WITH their status lists
      * ORG / SETTINGS / PLAN(ENTERPRISE) / SLUG

    Hand-rolling these produced status-less pipelines and empty permission
    lists; always go through the builders.
    """
    now = datetime.now(timezone.utc).isoformat()
    recs: list[dict] = []

    org = Organization(
        org_id=ORG_ID, slug=ORG_SLUG, name=ORG_DISPLAY_NAME,
        owner_user_id="",  # set by the `finalize-owner` step once subs exist
        status=OrgStatus.ACTIVE, plan_tier=PlanTier.ENTERPRISE,
        created_at=now, updated_at=now,
    )
    recs.append(to_ddb(OrgMapper.org_to_dynamo(org)))
    recs.append(to_ddb(OrgMapper.settings_to_dynamo(
        OrgSettings.create_default(org_id=ORG_ID, display_name=ORG_DISPLAY_NAME))))
    recs.append(to_ddb(OrgMapper.plan_to_dynamo(
        plan_from_template(ORG_ID, PlanTier.ENTERPRISE))))

    for rid, name in ((OWNER_ROLE_ID, "Owner"), (ADMIN_ROLE_ID, "Admin"),
                      (MEMBER_ROLE_ID, "Member")):
        recs.append(to_ddb(_role_record(ORG_ID, rid, name, now)))
    for rid in DEFAULT_PROJECT_ROLE_IDS:
        recs.append(to_ddb(_project_role_record(
            ORG_ID, rid, PROJECT_ROLE_DISPLAY_NAMES[rid], now)))

    for pipeline in build_default_pipelines(ORG_ID):
        recs.append(to_ddb(_pipeline_record(ORG_ID, pipeline, now)))

    recs.append(to_ddb(OrgMapper.slug_record(ORG_ID, ORG_SLUG, now)))
    return recs


def step_data(dry: bool) -> None:
    sub_map = load_sub_map()
    src = scan_all(SRC_TABLE)
    print(f"source items: {len(src)}")

    written = skipped = existing = 0
    by_kind: dict[str, int] = {}

    for rec in build_org_records():
        if put_new(DST_TABLE, rec, dry):
            written += 1
        else:
            existing += 1
    print(f"org scaffolding: {written} records")

    for item in src:
        kind = classify(item)
        if kind is None:
            skipped += 1
            continue
        out = remap(transform(item, kind), sub_map)
        if put_new(DST_TABLE, out, dry):
            written += 1
            by_kind[kind] = by_kind.get(kind, 0) + 1
        else:
            existing += 1

    print(f"\n{'[dry-run] ' if dry else ''}written={written} existing={existing} skipped={skipped}")
    for k, n in sorted(by_kind.items(), key=lambda x: -x[1]):
        print(f"  {k:18} x{n}")


# ---------------------------------------------------------------------------
# Step 3 — S3: server-side copy + rekey
# ---------------------------------------------------------------------------

def step_s3(dry: bool) -> None:
    sub_map = load_sub_map()
    keys, kw = [], {"Bucket": SRC_BUCKET}
    while True:
        r = s3.list_objects_v2(**kw)
        keys += [o["Key"] for o in r.get("Contents", [])]
        if not r.get("IsTruncated"):
            break
        kw["ContinuationToken"] = r["NextContinuationToken"]
    print(f"source objects: {len(keys)}")

    copied = unmapped = skipped_releases = other = 0
    for key in keys:
        parts = key.split("/")
        # legacy user upload: {prefix}/{oldSub}/{file}
        if len(parts) == 3 and parts[0] in UPLOAD_PREFIXES:
            prefix, old_sub, fname = parts
            new_sub = sub_map.get(old_sub)
            if not new_sub:
                print(f"  UNMAPPED sub, skipping: {key}")
                unmapped += 1
                continue
            dst = f"orgs/{ORG_ID}/{prefix}/{new_sub}/{fname}"
        elif parts[0] == "releases":
            # Obsolete desktop-release mirror. Downloads now come from GitHub
            # Releases only (the S3/CloudFront mirror was removed from
            # release.yml), so these build artifacts are not migrated.
            skipped_releases += 1
            continue
        else:
            print(f"  UNEXPECTED key shape, skipping: {key}")
            other += 1
            continue

        if not dry:
            s3.copy_object(Bucket=DST_BUCKET, Key=dst,
                           CopySource={"Bucket": SRC_BUCKET, "Key": key})
        copied += 1
        if copied % 500 == 0:
            print(f"  ...{copied}/{len(keys)}")

    print(f"\n{'[dry-run] ' if dry else ''}copied={copied} unmapped={unmapped} "
          f"skipped_releases={skipped_releases} other={other}")


# ---------------------------------------------------------------------------
# Step 4 — verify
# ---------------------------------------------------------------------------

def step_verify() -> None:
    sub_map = load_sub_map()
    src, dst = scan_all(SRC_TABLE), scan_all(DST_TABLE)

    def hist(items):
        h: dict[str, int] = {}
        for it in items:
            k = s(it, "SK").split("#")[0]
            h[k] = h.get(k, 0) + 1
        return h

    print(f"source items: {len(src)}   target items: {len(dst)}")
    hs, hd = hist(src), hist(dst)
    print(f"\n{'type':18} {'prod':>6} {'v2':>6}")
    for k in sorted(set(hs) | set(hd)):
        print(f"  {k:16} {hs.get(k,0):>6} {hd.get(k,0):>6}")

    blob = json.dumps(dst)
    dangling = [o for o in sub_map if o in blob]
    print(f"\ndangling OLD subs in v2: {len(dangling)} {dangling or '(none - good)'}")
    legacy_cdn = blob.count(SRC_CDN)
    print(f"legacy CDN refs in v2:   {legacy_cdn} {'(none - good)' if not legacy_cdn else '<-- BAD'}")

    n = s3.list_objects_v2(Bucket=DST_BUCKET).get("KeyCount", 0)
    print(f"v2 S3 objects (first page): {n}")
    print(f"v2 Cognito users: {len(cog.list_users(UserPoolId=DST_POOL)['Users'])}")


# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["cognito", "data", "s3", "verify"])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    print(f"profile={PROFILE} region={REGION}  {SRC_TABLE} -> {DST_TABLE}\n")
    if a.step == "cognito":
        step_cognito(a.dry_run)
    elif a.step == "data":
        step_data(a.dry_run)
    elif a.step == "s3":
        step_s3(a.dry_run)
    else:
        step_verify()


if __name__ == "__main__":
    main()
