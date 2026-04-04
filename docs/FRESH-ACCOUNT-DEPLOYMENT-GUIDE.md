# Fresh Deployment to a New AWS Account

Deploy the TaskFlow application to a completely new AWS account — fresh start, no data migration. Just the infrastructure, code, and a new OWNER account. The old account continues running independently.

---

## What Gets Created (all new, empty)

| Resource | New Instance |
|----------|-------------|
| DynamoDB table | Empty — no users, projects, or tasks |
| Cognito User Pool | Empty — seed one OWNER account |
| API Gateway | New URL |
| 40+ Lambda functions | Same code, new deployment |
| S3 bucket | Empty |
| CloudFront CDN | New domain |
| Secrets Manager | New secrets (Gmail, Groq) |
| EventBridge rule | Daily summary cron |

---

## Steps

### Step 1: Get Access to the New Account

Either:
- Create your own new account at `aws.amazon.com`, OR
- Get access to a team account via AWS SSO (like `devinstance1`/`devinstance2` from your team lead)

Set up CLI:
```bash
aws configure --profile new-account
# Enter: Access Key, Secret Key, region=ap-south-1
```

Verify:
```bash
aws sts get-caller-identity --profile new-account
```

### Step 2: Bootstrap CDK in the New Account

CDK requires a one-time bootstrap per account/region:

```bash
cd backend/cdk
cdk bootstrap aws://NEW_ACCOUNT_ID/ap-south-1 --profile new-account
```

### Step 3: Fix Hardcoded Gmail Credentials

**Before deploying**, fix `backend/cdk/stack.py` — the file currently contains hardcoded Gmail credentials in plaintext. This is a security risk.

**Current code (remove this):**
```python
gmail_secret = secretsmanager.Secret(
    self,
    "GmailCredentials",
    secret_name=config["gmail_secret_name"],
    description="Gmail SMTP credentials for TaskFlow welcome emails",
    secret_string_value=cdk.SecretValue.unsafe_plain_text(
        '{"user":"...","password":"..."}'
    ),
)
```

**Replace with:**
```python
gmail_secret = secretsmanager.Secret.from_secret_name_v2(
    self, "GmailCredentials", config["gmail_secret_name"]
)
```

This references a pre-created secret by name instead of creating one with hardcoded values.

### Step 4: Pre-Create Secrets in the New Account

Create both secrets manually before deploying the CDK stack:

```bash
# Gmail SMTP credentials (for welcome emails)
aws secretsmanager create-secret \
  --name "taskflow/gmail-credentials" \
  --secret-string '{"user":"your-email@gmail.com","password":"your-gmail-app-password"}' \
  --region ap-south-1 \
  --profile new-account

# Groq API key (for AI activity summaries)
aws secretsmanager create-secret \
  --name "taskflow/groq-api-key" \
  --secret-string '{"api_key":"your-groq-api-key"}' \
  --region ap-south-1 \
  --profile new-account
```

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords → Generate one for "Mail".

> **Groq API Key**: Get from [console.groq.com](https://console.groq.com).

### Step 5: Deploy the Stack

```bash
cd backend/cdk
cdk deploy --profile new-account --require-approval never
```

This takes ~5 minutes and creates all AWS resources. Note the outputs:

```
Outputs:
task-management.ApiUrl = https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/prod/
task-management.UserPoolId = ap-south-1_XXXXXXXXX
task-management.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
task-management.TableName = TaskManagementTable
task-management.UploadsBucketName = taskflow-uploads-prod
task-management.CDNDomain = xxxxxxxxxx.cloudfront.net
```

**Save these values** — you'll need them for the next steps.

### Step 6: Seed OWNER Account

Create the first admin user in Cognito:

```bash
# Create the user
aws cognito-idp admin-create-user \
  --user-pool-id <NEW_POOL_ID> \
  --username admin@company.com \
  --user-attributes \
    Name=email,Value=admin@company.com \
    Name=email_verified,Value=true \
    Name=custom:systemRole,Value=OWNER \
  --message-action SUPPRESS \
  --profile new-account \
  --region ap-south-1

# Set a permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <NEW_POOL_ID> \
  --username admin@company.com \
  --password "YourSecurePassword@123" \
  --permanent \
  --profile new-account \
  --region ap-south-1
```

The `admin-create-user` command returns a `sub` (UUID). Use it to create the DynamoDB profile:

```bash
aws dynamodb put-item \
  --table-name TaskManagementTable \
  --profile new-account \
  --region ap-south-1 \
  --item '{
    "PK": {"S": "USER#<COGNITO_SUB>"},
    "SK": {"S": "PROFILE"},
    "GSI1PK": {"S": "USER_EMAIL#admin@company.com"},
    "GSI1SK": {"S": "PROFILE"},
    "user_id": {"S": "<COGNITO_SUB>"},
    "email": {"S": "admin@company.com"},
    "name": {"S": "Admin"},
    "system_role": {"S": "OWNER"},
    "created_at": {"S": "2026-04-04T00:00:00Z"}
  }'
```

Replace `<COGNITO_SUB>` with the actual `sub` value from the create-user output.

### Step 7: Point Frontend to New Account

#### Option A: Same Vercel Project (update env vars)

1. Go to **Vercel Dashboard → Project Settings → Environment Variables**
2. Update these for **Production** scope:

| Variable | New Value |
|----------|-----------|
| `NEXT_PUBLIC_API_URL` | `https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/prod` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `ap-south-1_XXXXXXXXX` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `NEXT_PUBLIC_AWS_REGION` | `ap-south-1` |

3. Trigger a redeploy: **Deployments → most recent → Redeploy**

#### Option B: New Vercel Project

1. Import the same GitHub repo as a new Vercel project
2. Set all environment variables pointing to the new account
3. Gets a new Vercel domain (e.g., `taskflow-v2.vercel.app`)

#### Update Local Dev

Update `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://xxxxxxxxxx.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=deql0euvz
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=taskflow-avatars
```

### Step 8: Update Desktop App Config

Update the desktop app config with the new API URL, Cognito Pool ID, and Client ID. Rebuild and distribute the new installer.

### Step 9: Update CORS (if Vercel domain changed)

If you're using a new Vercel domain, update the CORS origins in `backend/cdk/stack.py`:

```python
DEFAULT_CONFIG = {
    "cors_origins": ["https://your-new-domain.vercel.app", "http://localhost:3000"],
    "allowed_origin": "https://your-new-domain.vercel.app",
    "app_url": "https://your-new-domain.vercel.app",
    ...
}
```

Then redeploy:
```bash
cdk deploy --profile new-account --require-approval never
```

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/cdk/stack.py` | Remove hardcoded Gmail creds → `Secret.from_secret_name_v2()`. Update CORS if domain changes. |
| `frontend/.env.local` | New API URL, Pool ID, Client ID |
| `frontend/.env.production` | Same |
| Vercel Dashboard | Update env vars |
| Desktop config | New API URL, Pool ID, Client ID |

---

## Verification Checklist

After deployment, verify:

- [ ] `cdk deploy` succeeds in new account
- [ ] Login with OWNER account works (web)
- [ ] Login with OWNER account works (desktop)
- [ ] Can create new users from the app
- [ ] New users receive welcome email with OTP
- [ ] Attendance sign-in/sign-out works
- [ ] File upload works (avatars via S3 + CDN)
- [ ] Daily summary EventBridge rule is active
- [ ] No Lambda errors in CloudWatch logs

---

## Timeline

| Step | Duration |
|------|----------|
| Account access + CDK bootstrap | 15 min |
| Fix Gmail creds + create secrets | 15 min |
| CDK deploy | 5 min |
| Seed OWNER + point frontend | 15 min |
| Verify | 10 min |
| **Total** | **~1 hour** |

---

## Old Account

The old account is **completely independent**. It continues running with its own data. You can:
- Keep it running as-is (costs apply for DynamoDB, Lambda invocations, etc.)
- Destroy the old stack when no longer needed:
  ```bash
  cd backend/cdk
  cdk destroy --profile old-account
  ```
- Delete retained resources (S3 bucket) manually after stack deletion
