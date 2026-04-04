# Full Account Migration Guide

Migrate the entire TaskFlow application — infrastructure, code, **and all data** (users, projects, tasks, attendance, files) — from one AWS account to another with minimal downtime.

---

## What Needs to Move

| Resource | Data | Migration Method |
|----------|------|-----------------|
| DynamoDB (`TaskManagementTable`) | Users, projects, tasks, comments, attendance, day-offs, activity | Scan + BatchWrite script |
| Cognito User Pool | User accounts (email, role, employee ID) | Pre-create users + Migration Lambda trigger for passwords |
| S3 bucket | Uploaded avatars and attachments | `aws s3 sync` |
| Secrets Manager | Gmail creds, Groq API key | Recreate manually |
| Lambda functions (40+) | No data — code only | CDK redeploys automatically |
| API Gateway | No data — routes only | CDK recreates automatically |
| CloudFront CDN | No data | CDK recreates (new domain) |
| EventBridge rule | Cron schedule only | CDK recreates automatically |

---

## The Two Hard Problems

### Problem 1: Cognito Passwords Cannot Be Exported

AWS Cognito **does not allow exporting user passwords**. Two approaches:

| Approach | How | User Experience |
|----------|-----|-----------------|
| **Migration Lambda trigger (recommended)** | Attach a trigger to the new pool. When a user logs in, it authenticates against the OLD pool. If successful, the user is created in the new pool with that password. | **Invisible** — users log in normally |
| **Force password reset** | Pre-create all users, send "reset your password" email | **Disruptive** — every user must reset |

**Recommendation**: Use the Migration Lambda trigger. Keep the old account running for 2-4 weeks until all users have logged in at least once.

### Problem 2: Cognito User IDs (sub) Change

Every user has a `sub` (UUID) in Cognito. This `sub` is used as the primary key (`USER#{sub}`) throughout DynamoDB — in PKs, SKs, GSI keys, `assigned_to` arrays, `created_by` fields, project members, etc.

When users are created in the new Cognito pool, they get a **new sub**. This means every DynamoDB record referencing a user must be updated.

**Solution**:
1. Pre-create all users in the new pool → get new subs
2. Build a mapping: `old_sub → new_sub`
3. Update every DynamoDB record that contains any old sub

---

## Migration Phases

### Phase 0: Preparation (Day -1)

#### 0.1 Set Up CLI Profiles

```bash
# Source account (current)
aws configure --profile source
# Access Key, Secret Key, region=ap-south-1

# Target account (new)
aws configure --profile target
# Access Key, Secret Key, region=ap-south-1
```

Verify both:
```bash
aws sts get-caller-identity --profile source
aws sts get-caller-identity --profile target
```

#### 0.2 Record Current Resource IDs

```bash
aws cloudformation describe-stacks \
  --stack-name task-management \
  --region ap-south-1 \
  --profile source \
  --query "Stacks[0].Outputs"
```

Save: API URL, User Pool ID, Client ID, Table Name, S3 Bucket, CDN Domain.

#### 0.3 Count Your Data

```bash
# DynamoDB items
aws dynamodb scan --table-name TaskManagementTable --select COUNT \
  --profile source --region ap-south-1

# S3 objects
aws s3 ls s3://taskflow-uploads-prod --recursive --summarize \
  --profile source --region ap-south-1 | tail -2

# Cognito users
aws cognito-idp list-users --user-pool-id ap-south-1_XXXXX \
  --profile source --region ap-south-1 --query "Users | length(@)"
```

#### 0.4 Fix Hardcoded Gmail Credentials in stack.py

Remove the hardcoded password from `backend/cdk/stack.py`. Replace:

```python
gmail_secret = secretsmanager.Secret(
    self, "GmailCredentials",
    secret_name=config["gmail_secret_name"],
    secret_string_value=cdk.SecretValue.unsafe_plain_text('{"user":"...","password":"..."}'),
)
```

With:
```python
gmail_secret = secretsmanager.Secret.from_secret_name_v2(
    self, "GmailCredentials", config["gmail_secret_name"]
)
```

#### 0.5 Bootstrap CDK in Target Account

```bash
cd backend/cdk
cdk bootstrap aws://TARGET_ACCOUNT_ID/ap-south-1 --profile target
```

#### 0.6 Pre-Create Secrets in Target Account

```bash
# Get current secret values from source
aws secretsmanager get-secret-value --secret-id "taskflow/gmail-credentials" \
  --profile source --region ap-south-1 --query SecretString --output text

aws secretsmanager get-secret-value --secret-id "taskflow/groq-api-key" \
  --profile source --region ap-south-1 --query SecretString --output text

# Create in target
aws secretsmanager create-secret --name "taskflow/gmail-credentials" \
  --secret-string '<value-from-above>' \
  --region ap-south-1 --profile target

aws secretsmanager create-secret --name "taskflow/groq-api-key" \
  --secret-string '<value-from-above>' \
  --region ap-south-1 --profile target
```

---

### Phase 1: Deploy Infrastructure to Target Account (~5 min)

```bash
cd backend/cdk
cdk deploy --profile target --require-approval never
```

Note the outputs:
- `ApiUrl` — new API Gateway URL
- `UserPoolId` — new Cognito pool ID
- `UserPoolClientId` — new client ID
- `UploadsBucketName` — new S3 bucket
- `CDNDomain` — new CloudFront domain

**At this point**: All infrastructure exists but is empty. No data yet.

---

### Phase 2: Migrate Cognito Users + Build Sub Mapping

#### 2.1 Export Users from Source Pool

```bash
aws cognito-idp list-users --user-pool-id <SOURCE_POOL_ID> \
  --profile source --region ap-south-1 > cognito-users.json
```

#### 2.2 Pre-Create Users in Target Pool + Build Mapping

Create `migrate_users.py`:

```python
import boto3
import json

source = boto3.Session(profile_name='source', region_name='ap-south-1')
target = boto3.Session(profile_name='target', region_name='ap-south-1')

source_cognito = source.client('cognito-idp')
target_cognito = target.client('cognito-idp')

SOURCE_POOL = '<SOURCE_POOL_ID>'
TARGET_POOL = '<TARGET_POOL_ID>'

# List all users from source pool
users = []
paginator = source_cognito.get_paginator('list_users')
for page in paginator.paginate(UserPoolId=SOURCE_POOL):
    users.extend(page['Users'])

print(f"Found {len(users)} users in source pool")

sub_mapping = {}  # old_sub -> new_sub

for user in users:
    attrs = {a['Name']: a['Value'] for a in user['Attributes']}
    old_sub = attrs['sub']
    email = attrs.get('email', '')
    name = attrs.get('name', '')
    role = attrs.get('custom:systemRole', 'MEMBER')
    emp_id = attrs.get('custom:employeeId', '')

    new_attrs = [
        {'Name': 'email', 'Value': email},
        {'Name': 'email_verified', 'Value': 'true'},
        {'Name': 'name', 'Value': name},
        {'Name': 'custom:systemRole', 'Value': role},
    ]
    if emp_id:
        new_attrs.append({'Name': 'custom:employeeId', 'Value': emp_id})

    try:
        resp = target_cognito.admin_create_user(
            UserPoolId=TARGET_POOL,
            Username=email,
            TemporaryPassword='TempMigrate123!',
            UserAttributes=new_attrs,
            MessageAction='SUPPRESS',
        )
        new_sub = next(a['Value'] for a in resp['User']['Attributes'] if a['Name'] == 'sub')
        sub_mapping[old_sub] = new_sub
        print(f"  {email}: {old_sub} -> {new_sub}")
    except Exception as e:
        print(f"  FAILED {email}: {e}")

with open('sub_mapping.json', 'w') as f:
    json.dump(sub_mapping, f, indent=2)

print(f"\nMigrated {len(sub_mapping)} users. Mapping saved to sub_mapping.json")
```

Run:
```bash
python migrate_users.py
```

---

### Phase 3: Migrate DynamoDB Data

Create `migrate_dynamodb.py`:

```python
import boto3
import json

with open('sub_mapping.json') as f:
    sub_mapping = json.load(f)

source = boto3.Session(profile_name='source', region_name='ap-south-1')
target = boto3.Session(profile_name='target', region_name='ap-south-1')

source_table = source.resource('dynamodb').Table('TaskManagementTable')
target_table = target.resource('dynamodb').Table('TaskManagementTable')

# Scan all items from source
print("Scanning source table...")
items = []
response = source_table.scan()
items.extend(response['Items'])
while 'LastEvaluatedKey' in response:
    response = source_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
    items.extend(response['Items'])

print(f"Scanned {len(items)} items")

def replace_subs(value):
    """Recursively replace old subs with new subs in any value."""
    if isinstance(value, str):
        for old_sub, new_sub in sub_mapping.items():
            value = value.replace(old_sub, new_sub)
        return value
    elif isinstance(value, list):
        return [replace_subs(v) for v in value]
    elif isinstance(value, dict):
        return {k: replace_subs(v) for k, v in value.items()}
    return value

# Replace subs and write to target
print("Writing to target table...")
with target_table.batch_writer() as batch:
    for item in items:
        new_item = replace_subs(item)
        batch.put_item(Item=new_item)

print(f"Wrote {len(items)} items to target table")
```

Run:
```bash
python migrate_dynamodb.py
```

Verify counts match:
```bash
aws dynamodb scan --table-name TaskManagementTable --select COUNT \
  --profile source --region ap-south-1

aws dynamodb scan --table-name TaskManagementTable --select COUNT \
  --profile target --region ap-south-1
```

---

### Phase 4: Migrate S3 Files

```bash
# Download from source
mkdir temp-s3-migration
aws s3 sync s3://<SOURCE_BUCKET> ./temp-s3-migration/ \
  --profile source --region ap-south-1

# Upload to target
aws s3 sync ./temp-s3-migration/ s3://<TARGET_BUCKET> \
  --profile target --region ap-south-1

# Cleanup local copy
rm -rf temp-s3-migration
```

---

### Phase 5: Update CDN URLs in DynamoDB

If avatar/attachment URLs are stored in DynamoDB with the old CloudFront domain, update them:

Create `update_cdn_urls.py`:

```python
import boto3

OLD_CDN = '<old-cdn-domain>.cloudfront.net'
NEW_CDN = '<new-cdn-domain>.cloudfront.net'

target = boto3.Session(profile_name='target', region_name='ap-south-1')
table = target.resource('dynamodb').Table('TaskManagementTable')

# Scan all items
items = []
response = table.scan()
items.extend(response['Items'])
while 'LastEvaluatedKey' in response:
    response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
    items.extend(response['Items'])

updated = 0
for item in items:
    changed = False
    new_item = dict(item)
    for key, value in new_item.items():
        if isinstance(value, str) and OLD_CDN in value:
            new_item[key] = value.replace(OLD_CDN, NEW_CDN)
            changed = True
    if changed:
        table.put_item(Item=new_item)
        updated += 1

print(f"Updated {updated} items with new CDN domain")
```

---

### Phase 6: Set Up Password Migration Lambda

This Lambda allows users to log in with their old passwords. When a user logs in to the new pool, Cognito calls this Lambda, which authenticates against the OLD pool. If successful, the user is created in the new pool with that password.

Create `user_migration_trigger.py`:

```python
import boto3

old_client = boto3.client('cognito-idp', region_name='ap-south-1')
OLD_CLIENT_ID = '<SOURCE_CLIENT_ID>'

def handler(event, context):
    if event['triggerSource'] != 'UserMigration_Authentication':
        return event

    email = event['userName']
    password = event['request']['password']

    try:
        # Authenticate against the OLD pool
        old_client.initiate_auth(
            AuthFlow='USER_PASSWORD_AUTH',
            ClientId=OLD_CLIENT_ID,
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password,
            },
        )

        # Success — tell Cognito to confirm the user with this password
        event['response']['finalUserStatus'] = 'CONFIRMED'
        event['response']['messageAction'] = 'SUPPRESS'
        return event

    except old_client.exceptions.NotAuthorizedException:
        raise Exception("Bad credentials")
    except Exception as e:
        raise Exception(f"Migration failed: {str(e)}")
```

Deploy this Lambda in the target account and attach it as a trigger:

```bash
# After deploying the Lambda (named "CognitoUserMigration"):
aws cognito-idp update-user-pool \
  --user-pool-id <TARGET_POOL_ID> \
  --lambda-config UserMigration=arn:aws:lambda:ap-south-1:<TARGET_ACCOUNT_ID>:function:CognitoUserMigration \
  --profile target --region ap-south-1

# Grant Cognito permission to invoke the Lambda
aws lambda add-permission \
  --function-name CognitoUserMigration \
  --statement-id cognito-invoke \
  --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com \
  --source-arn arn:aws:cognito-idp:ap-south-1:<TARGET_ACCOUNT_ID>:userpool/<TARGET_POOL_ID> \
  --profile target --region ap-south-1
```

> **Note**: The source account's Cognito pool must remain running for this to work. The `initiate_auth` call is unauthenticated (public API), so no cross-account IAM is needed.

---

### Phase 7: Cutover (~5 min downtime)

Execute these steps in order:

1. **Announce maintenance** — "5 minutes maintenance"
2. **Final DynamoDB sync** — run `migrate_dynamodb.py` one last time to capture recent writes
3. **Final S3 sync** — `aws s3 sync` one last time
4. **Update Vercel env vars** — point to new API URL, Pool ID, Client ID
5. **Trigger Vercel redeploy**
6. **Update `frontend/.env.local`** — for local dev
7. **Rebuild desktop app** — with new config values
8. **Verify** — log in, check data, test features

### Cutover Order (important)

```
1. Final data sync           → ensures no data loss
2. Update Vercel + redeploy  → frontend points to new backend (~1-2 min)
3. Verify login              → confirms Cognito + DynamoDB working
4. Rebuild desktop app       → can be done after cutover
```

---

### Phase 8: Post-Migration (2-4 weeks)

**Keep the old account running** — the migration Lambda trigger needs the old Cognito pool to verify passwords.

#### Monitor Unmigrated Users

Check users who haven't logged in since migration:
```bash
aws cognito-idp list-users \
  --user-pool-id <TARGET_POOL_ID> \
  --filter "status = \"FORCE_CHANGE_PASSWORD\"" \
  --profile target --region ap-south-1
```

These users still need the old pool. Contact them to log in, or force a password reset.

#### Remove Migration Trigger (after all users migrated)

```bash
aws cognito-idp update-user-pool \
  --user-pool-id <TARGET_POOL_ID> \
  --lambda-config '{}' \
  --profile target --region ap-south-1
```

#### Cleanup Old Account

```bash
# Delete the old stack
cd backend/cdk
cdk destroy --profile source

# Delete retained S3 bucket
aws s3 rb s3://taskflow-uploads-prod --force --profile source --region ap-south-1

# Delete old secrets
aws secretsmanager delete-secret --secret-id "taskflow/gmail-credentials" \
  --force-delete-without-recovery --profile source --region ap-south-1
aws secretsmanager delete-secret --secret-id "taskflow/groq-api-key" \
  --force-delete-without-recovery --profile source --region ap-south-1
```

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/cdk/stack.py` | Remove hardcoded Gmail creds → `Secret.from_secret_name_v2()` |
| `backend/cdk/stack.py` | Update CORS origins if Vercel domain changes |
| `frontend/.env.local` | New API URL, Pool ID, Client ID |
| `frontend/.env.production` | Same |
| Vercel Dashboard | Update env vars |
| Desktop config | New API URL, Pool ID, Client ID |

## Scripts Created (run locally, disposable)

| Script | Purpose |
|--------|---------|
| `migrate_users.py` | Export users from old pool → create in new pool → save sub mapping |
| `migrate_dynamodb.py` | Scan source table → replace old subs → write to target table |
| `update_cdn_urls.py` | Replace old CDN domain with new one in DynamoDB records |
| `user_migration_trigger.py` | Lambda trigger for transparent password migration |

---

## Verification Checklist

- [ ] DynamoDB item count matches source and target
- [ ] S3 object count matches
- [ ] Cognito user count matches
- [ ] Login works with existing password (web)
- [ ] Login works with existing password (desktop)
- [ ] All projects, tasks, members visible
- [ ] Avatars and attachments load correctly (new CDN domain)
- [ ] Attendance sign-in/sign-out works
- [ ] File upload works
- [ ] Creating new users works (welcome email sent)
- [ ] EventBridge daily summary rule is active
- [ ] No Lambda errors in CloudWatch logs

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| S3 bucket name collision | CDK auto-generates unique name with account prefix |
| Cognito sub mismatch breaks user references | Pre-create users, build mapping, replace all subs in DynamoDB |
| Old CDN URLs stored in DynamoDB | `update_cdn_urls.py` script |
| Users can't log in after migration | Keep old pool running + migration Lambda trigger |
| Data written during cutover window is lost | Final delta sync right before cutover |
| Desktop app has old config baked in | Rebuild and redistribute after cutover |

---

## Timeline

| Phase | Duration |
|-------|----------|
| Phase 0: Preparation | 1-2 hours |
| Phase 1: Deploy infrastructure | 5 min |
| Phase 2: Migrate Cognito users | 15 min |
| Phase 3: Migrate DynamoDB | 15-30 min (depends on data size) |
| Phase 4: Migrate S3 | 5-15 min (depends on file count) |
| Phase 5: Update CDN URLs | 5 min |
| Phase 6: Set up migration Lambda | 30 min |
| Phase 7: Cutover | 5 min downtime |
| Phase 8: Post-migration monitoring | 2-4 weeks |
| **Total active work** | **~3-4 hours** |
