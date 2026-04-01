# TaskFlow — Company Account Migration Guide

Complete checklist for migrating TaskFlow from personal/dev accounts to company-owned accounts (AWS, Vercel, Cloudinary, Gmail SMTP). This is a **fresh start** — no data migration.

> **Important:** The company AWS account already has an existing serverless application. This guide ensures TaskFlow deploys with **fully isolated resources** so there is zero interference.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Resource Isolation (CRITICAL)](#2-resource-isolation-critical)
3. [AWS Account Setup](#3-aws-account-setup)
4. [Company Email / SMTP Setup](#4-company-email--smtp-setup)
5. [Cloudinary Setup](#5-cloudinary-setup)
6. [Code Changes Before Deploy](#6-code-changes-before-deploy)
7. [Deploy Backend (CDK)](#7-deploy-backend-cdk)
8. [Seed OWNER Account](#8-seed-owner-account)
9. [Vercel Setup (Frontend)](#9-vercel-setup-frontend)
10. [Post-Deploy: Update CORS & Re-deploy](#10-post-deploy-update-cors--re-deploy)
11. [Verification Checklist](#11-verification-checklist)
12. [Security Cleanup](#12-security-cleanup)

---

## 1. Prerequisites

- [ ] Company AWS account with **AdministratorAccess** (or scoped IAM permissions for Lambda, API Gateway, DynamoDB, Cognito, Secrets Manager, CloudFormation, IAM, CloudWatch)
- [ ] AWS CLI v2 installed and configured with company credentials (`aws configure`)
- [ ] AWS CDK v2 installed (`npm install -g aws-cdk`)
- [ ] Python 3.12 installed
- [ ] Node.js 18+ installed
- [ ] Company Vercel account / organization
- [ ] Company Cloudinary account
- [ ] Company Gmail account with App Password (or alternative SMTP provider)
- [ ] Git access to the repository
- [ ] **Know the existing app's resource names** — check with the team to confirm no naming conflicts (see Section 2)

---

## 2. Resource Isolation (CRITICAL)

The company AWS account already has a serverless application. TaskFlow uses **hardcoded resource names** that could clash. You **must** prefix or rename these before deploying.

### 2.1 What Could Conflict

| Resource Type | Current Hardcoded Name | Unique Per | Risk Level |
|---------------|----------------------|------------|------------|
| CloudFormation Stack | `task-management` | Region | **HIGH** — deploy will fail or overwrite |
| DynamoDB Table | `TaskManagementTable` | Region | **HIGH** — deploy will fail if name taken |
| Secrets Manager | `taskflow/gmail-credentials` | Region | **HIGH** — deploy will fail if name taken |
| Cognito User Pool | `TaskManagementUserPool` | Region | LOW — duplicates allowed |
| Cognito Client | `TaskManagementClient` | Region | LOW — duplicates allowed |
| API Gateway | `TaskManagementApi` | Region | LOW — duplicates allowed |
| Lambda Functions | `CreateProject`, `ListTasks`, etc. | Stack-scoped | LOW — CDK prefixes with stack name |
| Lambda Layer | `DepsLayer` | Stack-scoped | LOW — CDK prefixes with stack name |

### 2.2 Required Changes — Prefix All Resource Names

Choose a unique prefix for your app (e.g., `taskflow-` or your team name). Apply it to these **3 critical resources**:

#### A. CloudFormation Stack Name — `backend/cdk/app.py` (line 6)

```python
# BEFORE:
TaskManagementStack(app, "task-management", env=cdk.Environment(region="ap-south-1"))

# AFTER — use a unique stack name:
TaskManagementStack(app, "taskflow-app", env=cdk.Environment(region="ap-south-1"))
```

> This changes the CloudFormation stack name. All Lambda functions, IAM roles, and other CDK-generated resources will automatically be prefixed with `taskflow-app-` instead of `task-management-`, preventing Lambda name collisions.

#### B. DynamoDB Table Name — `backend/cdk/stack.py` (line 31)

```python
# BEFORE:
table_name="TaskManagementTable",

# AFTER:
table_name="TaskFlowTable",
```

#### C. Secrets Manager Secret Name — `backend/cdk/stack.py` (line 130)

```python
# BEFORE:
secret_name="taskflow/gmail-credentials",

# AFTER:
secret_name="taskflow-app/gmail-credentials",
```

### 2.3 Optional — Rename for Clarity in AWS Console

These won't cause conflicts but help distinguish your resources when browsing the console:

| File & Line | Current | Suggested |
|-------------|---------|-----------|
| `stack.py` line 57 | `user_pool_name="TaskManagementUserPool"` | `"TaskFlowUserPool"` |
| `stack.py` line 86 | `user_pool_client_name="TaskManagementClient"` | `"TaskFlowClient"` |
| `stack.py` line 108 | `rest_api_name="TaskManagementApi"` | `"TaskFlowApi"` |

### 2.4 Verify No Conflicts Before Deploy

Run these commands against the company account to check for existing resources:

```bash
# Check if DynamoDB table name exists
aws dynamodb describe-table --table-name TaskFlowTable 2>&1

# Check if Secrets Manager secret exists
aws secretsmanager describe-secret --secret-id taskflow-app/gmail-credentials 2>&1

# Check if CloudFormation stack exists
aws cloudformation describe-stacks --stack-name taskflow-app 2>&1
```

All three should return **"not found"** errors. If any resource exists, choose a different name.

### 2.5 What CDK Handles Automatically (No Action Needed)

CDK auto-prefixes these with the stack name — **no conflict risk**:

- Lambda function names → `taskflow-app-CreateProject-XXXXX`
- IAM roles → `taskflow-app-CreateProjectServiceRole-XXXXX`
- Lambda Layer versions
- CloudWatch Log Groups (follow Lambda naming)
- API Gateway deployment IDs

### 2.6 IAM Isolation

TaskFlow's Lambda functions get their own IAM roles (created by CDK). They only have access to:
- **Only** the TaskFlow DynamoDB table (not the existing app's tables)
- **Only** the TaskFlow Cognito User Pool
- **Only** the TaskFlow Secrets Manager secret

There is **no cross-application access** — CDK scopes all IAM permissions to the specific resources in this stack.

---

## 3. AWS Account Setup

### 3.1 Configure AWS CLI Profile

```bash
aws configure --profile company
# AWS Access Key ID: <company-access-key>
# AWS Secret Access Key: <company-secret-key>
# Default region: ap-south-1  (or your preferred region)
# Default output format: json
```

Set as default or export:

```bash
export AWS_PROFILE=company
```

### 3.2 Bootstrap CDK

CDK needs to be bootstrapped once per account/region:

```bash
cd backend/cdk
pip install -r requirements.txt
cdk bootstrap aws://<COMPANY_ACCOUNT_ID>/ap-south-1
```

### 3.3 Update Region (If Changing)

If your company uses a different AWS region than `ap-south-1`, update:

**File:** `backend/cdk/app.py`

```python
# Change region (stack name already updated in Section 2):
TaskManagementStack(app, "taskflow-app", env=cdk.Environment(region="<YOUR_REGION>"))
```

**File:** `backend/src/infrastructure/cognito/cognito_service.py`

```python
# Update the fallback region:
cognito_client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "<YOUR_REGION>"))
```

---

## 4. Company Email / SMTP Setup

### 4.1 Gmail App Password (Recommended)

1. Log into the **company Gmail account**
2. Go to [Google Account > Security > 2-Step Verification](https://myaccount.google.com/security)
3. Enable 2-Step Verification if not already enabled
4. Go to **App Passwords** → Generate a new app password for "Mail"
5. Copy the 16-character password

### 4.2 Alternative: Use Amazon SES

If you prefer AWS SES over Gmail SMTP, you'll need to modify `backend/src/infrastructure/email/gmail_service.py` to use SES instead. This is optional.

### 4.3 Update Email Branding

**File:** `backend/src/infrastructure/email/gmail_service.py`

| What to Change | Current Value | New Value |
|----------------|--------------|-----------|
| Sender display name | `TaskFlow <giridharans0624@gmail.com>` | `TaskFlow <company-email@company.com>` |

**File:** `backend/src/infrastructure/email/email_templates.py`

| What to Change | Current Value | New Value |
|----------------|--------------|-----------|
| Footer branding | `Powered by NEUROSTACK` | `Powered by <YOUR_COMPANY>` |
| Any other branding references | NEUROSTACK | Your company name |

---

## 5. Cloudinary Setup

### 5.1 Create Account & Upload Preset

1. Sign up at [cloudinary.com](https://cloudinary.com) with company email
2. Note your **Cloud Name** from the Dashboard
3. Go to **Settings > Upload > Upload Presets**
4. Create an **unsigned** upload preset:
   - **Preset name:** `taskflow-avatars` (or custom name)
   - **Folder:** `taskflow-avatars`
   - **Allowed formats:** `jpg, png, webp, gif`
   - **Max file size:** 5MB (recommended)
   - **Transformation:** `c_fill,w_256,h_256` (optional, auto-resize)

### 5.2 Values to Note

| Value | Where You'll Need It |
|-------|---------------------|
| Cloud Name | `frontend/.env.local` |
| Upload Preset Name | `frontend/.env.local` |

---

## 6. Code Changes Before Deploy

These changes **must** be made before running `cdk deploy`.

### 6.1 Remove Hardcoded Gmail Credentials (CRITICAL)

**File:** `backend/cdk/stack.py` (~line 127-135)

```python
# REMOVE THIS (hardcoded credentials):
gmail_secret = secretsmanager.Secret(
    self, "GmailCredentials",
    secret_name="taskflow/gmail-credentials",
    description="Gmail SMTP credentials for TaskFlow welcome emails",
    secret_string_value=cdk.SecretValue.unsafe_plain_text(
        '{"user":"giridharans0624@gmail.com","password":"mxhd sjrb rbny zexn"}'
    ),
)

# REPLACE WITH (no hardcoded creds + new secret name from Section 2):
gmail_secret = secretsmanager.Secret(
    self, "GmailCredentials",
    secret_name="taskflow-app/gmail-credentials",
    description="Gmail SMTP credentials for TaskFlow welcome emails",
)
```

### 6.2 Update CORS Origins & App URL

**File:** `backend/cdk/stack.py`

| Line | What to Change | Current Value | New Value |
|------|----------------|--------------|-----------|
| ~111 | CORS `allow_origins` | `["https://task-flow-ns.vercel.app", "http://localhost:3000"]` | `["https://<company-domain>.vercel.app", "http://localhost:3000"]` |
| ~142 | `ALLOWED_ORIGIN` | `"https://task-flow-ns.vercel.app"` | `"https://<company-domain>.vercel.app"` |
| ~240 | `APP_URL` | `"https://task-flow-ns.vercel.app"` | `"https://<company-domain>.vercel.app"` |

> **Note:** You won't know the exact Vercel URL until Step 9. Set `http://localhost:3000` for now and update after Vercel deploy (Step 10).

### 6.3 Update Resource Names (From Section 2)

Make sure you've applied all three resource name changes from Section 2.2:
- [ ] Stack name in `app.py`
- [ ] Table name in `stack.py`
- [ ] Secret name in `stack.py`

### 6.4 Update Password Reset Email (Optional)

**File:** `backend/cdk/stack.py` (~line 77-79)

The Cognito password reset email subject and body reference "TaskFlow" and "NEUROSTACK". Update if needed.

---

## 7. Deploy Backend (CDK)

### 7.1 Install Dependencies

```bash
cd backend/cdk
pip install -r requirements.txt
```

### 7.2 Synth First (Dry Run)

Preview the CloudFormation template before deploying:

```bash
cdk synth
```

Review the output to confirm resource names are correct and won't conflict.

### 7.3 Deploy the Stack

```bash
cdk deploy --require-approval broadening
```

### 7.4 Capture Outputs

After deployment, CDK will print outputs. **Save these — you'll need them for the frontend:**

| Output Key | What It Is | Example |
|-----------|-----------|---------|
| `ApiUrl` | API Gateway endpoint | `https://xxxxxxxxxx.execute-api.<region>.amazonaws.com/prod` |
| `UserPoolId` | Cognito User Pool ID | `<region>_XXXXXXXXX` |
| `UserPoolClientId` | Cognito App Client ID | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TableName` | DynamoDB table name | `TaskFlowTable` |

### 7.5 Set Gmail Secret Value

```bash
aws secretsmanager put-secret-value \
  --secret-id taskflow-app/gmail-credentials \
  --secret-string '{"user":"company-email@company.com","password":"<GMAIL_APP_PASSWORD>"}'
```

---

## 8. Seed OWNER Account

### 8.1 Create Cognito User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username owner@company.com \
  --user-attributes \
    Name=email,Value=owner@company.com \
    Name=email_verified,Value=true \
    Name=name,Value="Company Name" \
    Name=custom:systemRole,Value=OWNER \
    Name=custom:employeeId,Value=EMP-0001 \
  --message-action SUPPRESS
```

### 8.2 Set Permanent Password

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username owner@company.com \
  --password "YourSecurePassword@123" \
  --permanent
```

### 8.3 Get the Cognito Sub UUID

```bash
aws cognito-idp admin-get-user \
  --user-pool-id <UserPoolId> \
  --username owner@company.com \
  --query 'Username' --output text
```

### 8.4 Insert OWNER Record in DynamoDB

Replace `<cognito-sub-uuid>` with the value from 8.3. Use the **new table name**:

```bash
aws dynamodb put-item \
  --table-name TaskFlowTable \
  --item '{
    "PK": {"S": "USER#<cognito-sub-uuid>"},
    "SK": {"S": "PROFILE"},
    "GSI1PK": {"S": "USER_EMAIL#owner@company.com"},
    "GSI1SK": {"S": "PROFILE"},
    "GSI2PK": {"S": "EMPLOYEE_ID#EMP-0001"},
    "GSI2SK": {"S": "PROFILE"},
    "user_id": {"S": "<cognito-sub-uuid>"},
    "employee_id": {"S": "EMP-0001"},
    "email": {"S": "owner@company.com"},
    "name": {"S": "Company Name"},
    "system_role": {"S": "OWNER"},
    "department": {"S": "Management"},
    "created_at": {"S": "2026-04-01T00:00:00Z"},
    "updated_at": {"S": "2026-04-01T00:00:00Z"}
  }'
```

---

## 9. Vercel Setup (Frontend)

### 9.1 Create Vercel Project

1. Log into [Vercel](https://vercel.com) with company account
2. **Import** the Git repository
3. Set **Root Directory** to `frontend`
4. Set **Framework Preset** to `Next.js`

### 9.2 Configure Environment Variables

Add these in **Vercel > Project Settings > Environment Variables**:

| Variable | Value (from CDK outputs) |
|----------|-------------------------|
| `NEXT_PUBLIC_API_URL` | `https://xxxxxxxxxx.execute-api.<region>.amazonaws.com/prod` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `<region>_XXXXXXXXX` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `NEXT_PUBLIC_AWS_REGION` | `ap-south-1` (or your region) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `<your-cloudinary-cloud-name>` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `taskflow-avatars` (or your preset name) |

### 9.3 Deploy

Trigger a deploy (or push to the connected branch). **Note the production URL** — you'll need it for Step 10.

### 9.4 Custom Domain (Optional)

1. Go to **Vercel > Project > Settings > Domains**
2. Add your custom domain (e.g., `tasks.company.com`)
3. Configure DNS as instructed by Vercel

---

## 10. Post-Deploy: Update CORS & Re-deploy

Now that you know the Vercel production URL, go back and update the backend:

**File:** `backend/cdk/stack.py`

1. Set `ALLOWED_ORIGIN` to the actual Vercel URL (e.g., `https://taskflow-company.vercel.app`)
2. Set `APP_URL` to the same value
3. Update `allow_origins` in CORS config

Then re-deploy:

```bash
cd backend/cdk
cdk deploy
```

---

## 11. Verification Checklist

Test each feature end-to-end after migration:

### Authentication
- [ ] Login with OWNER account (email + password)
- [ ] Login with Employee ID
- [ ] Forgot password flow (email received)
- [ ] Token refresh works (stay logged in > 1 hour)

### User Management
- [ ] Create a new user (CEO/ADMIN/MEMBER)
- [ ] Welcome email received with OTP
- [ ] New user can log in and change password
- [ ] Employee ID auto-generated correctly

### Projects & Tasks
- [ ] Create a project
- [ ] Add members to project
- [ ] Create tasks with deadlines
- [ ] Task status pipeline works (domain-specific steps)
- [ ] Assign tasks to members

### Time Tracking
- [ ] Start timer (select project + task)
- [ ] Live timer ticking in sidebar
- [ ] Switch tasks (auto-stop + start)
- [ ] Sign out / stop timer
- [ ] Session recorded in attendance

### Day-Off Management
- [ ] Submit day-off request
- [ ] Approve/reject as CEO/MD
- [ ] Cancel request
- [ ] Day-off banner shows on attendance page

### Attendance & Reports
- [ ] Team attendance table shows live users
- [ ] Monthly attendance report loads
- [ ] CSV export works
- [ ] Summary / Detailed / Weekly report views work
- [ ] Charts render correctly

### Profile & UI
- [ ] Avatar upload works (Cloudinary)
- [ ] Profile completeness indicator
- [ ] Dark mode toggle
- [ ] Command palette (Ctrl+K)
- [ ] Notifications bell
- [ ] Walkthrough guide for new users

---

## 12. Security Cleanup

### On the OLD (Personal) Account

- [ ] Delete the old CDK stack: `cdk destroy` (removes all Lambda, API GW, DynamoDB, Cognito)
- [ ] Delete the old Secrets Manager secret (`taskflow/gmail-credentials`)
- [ ] Revoke the old Gmail App Password
- [ ] Rotate any AWS access keys that were used

### On the NEW (Company) Account

- [ ] Verify `.env.local` is in `.gitignore` (it is)
- [ ] Verify no credentials are hardcoded in `stack.py`
- [ ] Enable CloudTrail for audit logging (recommended)
- [ ] Enable AWS Config for compliance monitoring (optional)
- [ ] Set up billing alerts
- [ ] Restrict IAM permissions (least privilege for team members)

---

## Quick Reference: All Values That Change

| Item | Old (Personal) | New (Company) |
|------|---------------|---------------|
| AWS Account ID | `<old-account>` | `<company-account>` |
| AWS Region | `ap-south-1` | `<company-region>` |
| CloudFormation Stack | `task-management` | `taskflow-app` |
| DynamoDB Table | `TaskManagementTable` | `TaskFlowTable` |
| Secrets Manager | `taskflow/gmail-credentials` | `taskflow-app/gmail-credentials` |
| API Gateway URL | `https://3syc4x99a7.execute-api.ap-south-1.amazonaws.com/prod` | From CDK output |
| Cognito User Pool ID | `ap-south-1_72qWKeSH5` | From CDK output |
| Cognito Client ID | `pentcto4cmlfof93tsv738nct` | From CDK output |
| Vercel URL | `https://task-flow-ns.vercel.app` | `https://<company>.vercel.app` |
| Gmail sender | `giridharans0624@gmail.com` | `company-email@company.com` |
| Gmail App Password | (old password) | (new app password) |
| Cloudinary Cloud Name | `deql0euvz` | `<company-cloud-name>` |
| Cloudinary Preset | `taskflow-avatars` | `<company-preset>` |
| OWNER email | `admin@taskmanager.com` | `owner@company.com` |

---

## Files Modified During Migration

| File | Changes |
|------|---------|
| `backend/cdk/app.py` | Stack name, region |
| `backend/cdk/stack.py` | Table name, secret name, resource display names, CORS origins, APP_URL, ALLOWED_ORIGIN, hardcoded creds removed |
| `backend/src/infrastructure/cognito/cognito_service.py` | Fallback region (if changing) |
| `backend/src/infrastructure/email/gmail_service.py` | Sender email address |
| `backend/src/infrastructure/email/email_templates.py` | Company branding |
| `frontend/.env.local` | All 6 environment variables |
