# Feature Development Guide

A step-by-step guide for developing and testing new features **without affecting production users or data**.

---

## Overview

This project runs in production with real users. Any new feature must be developed and tested in an **isolated environment** before merging. This guide covers the full workflow — from creating a feature branch to merging into production.

### Architecture Recap

```
Production
├── Frontend  → Vercel (auto-deploys from main branch)
├── Backend   → AWS CDK (TaskManagementStack)
│   ├── Lambda Functions  → application code
│   ├── API Gateway       → REST endpoints
│   ├── DynamoDB Table    → all user/project/task data
│   └── Cognito Pool      → user accounts & authentication
```

---

## Step 1: Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/<feature-name>
```

All development happens on this branch. The `main` branch remains untouched — production stays stable.

---

## Step 2: Deploy an Isolated Staging Backend

Production uses a CDK stack named `TaskManagementStack`. To avoid any conflict, deploy a **second stack** with a different name.

### 2.1 Create a Staging CDK Entry Point

Duplicate `backend/cdk/app.py` as `backend/cdk/app_staging.py`:

```python
import aws_cdk as cdk
from stack import TaskManagementStack

app = cdk.App()
TaskManagementStack(app, "TaskManagementStagingStack")
app.synth()
```

### 2.2 Deploy the Staging Stack

```bash
cd backend/cdk
cdk deploy TaskManagementStagingStack --app "python app_staging.py"
```

This creates **completely separate** AWS resources:

| Resource | Production | Staging |
|----------|-----------|---------|
| DynamoDB Table | `TaskManagementStack-Table` | `TaskManagementStagingStack-Table` |
| Cognito Pool | Production pool | New staging pool |
| API Gateway | `https://prod-api.amazonaws.com/prod` | `https://staging-api.amazonaws.com/prod` |
| Lambda Functions | Production code | Your feature branch code |

> **Production is untouched.** Different stack name = different CloudFormation stack = zero overlap.

### 2.3 Note the Outputs

After deployment, CDK prints:

```
Outputs:
TaskManagementStagingStack.ApiUrl = https://<staging-id>.execute-api.ap-south-1.amazonaws.com/prod
TaskManagementStagingStack.UserPoolId = ap-south-1_XXXX
TaskManagementStagingStack.UserPoolClientId = XXXXXXXXXXXX
```

Save these values — you'll need them for the frontend.

### 2.4 Seed a Test OWNER Account

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <staging-pool-id> \
  --username admin@company.com \
  --user-attributes Name=email,Value=admin@company.com Name=custom:systemRole,Value=OWNER

aws cognito-idp admin-set-user-password \
  --user-pool-id <staging-pool-id> \
  --username admin@company.com \
  --password "SecurePassword@123" \
  --permanent
```

---

## Step 3: Point Frontend to Staging Backend

Update `frontend/.env.local` on your feature branch:

```env
NEXT_PUBLIC_API_URL=https://<staging-api-id>.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<staging-pool-id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<staging-client-id>
NEXT_PUBLIC_AWS_REGION=ap-south-1
```

Run the frontend locally:

```bash
cd frontend
npm run dev
```

Your local frontend now talks to the staging backend. Production users see nothing.

---

## Step 4: Vercel Preview Deployments (Optional)

Vercel auto-creates **Preview Deployments** for non-main branches. This lets you share a live URL with others for testing.

### 4.1 Push Your Feature Branch

```bash
git push -u origin feature/<feature-name>
```

Vercel builds a preview at `https://task-management-<hash>.vercel.app`.

### 4.2 Set Staging Environment Variables in Vercel

1. Go to **Vercel Dashboard → Project Settings → Environment Variables**
2. Add the staging values with scope set to **Preview** only:

| Variable | Value | Scope |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://<staging-api-id>...` | Preview |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `<staging-pool-id>` | Preview |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `<staging-client-id>` | Preview |

This ensures:
- **Preview deployments** → hit staging backend
- **Production deployment** → still hits production backend

> Using Vercel environment scopes is the **safest approach** — no need to manually revert `.env.local` before merging.

---

## Step 5: Develop & Test

### Daily Workflow

```
Write code → Test locally → Push to feature branch
                              ├── Vercel preview auto-updates (frontend)
                              └── Run cdk deploy staging (if backend changed)
```

### Redeploy Backend After Changes

```bash
cd backend/cdk
cdk deploy TaskManagementStagingStack --app "python app_staging.py"
```

### Environment Summary

| Component | Points to |
|-----------|-----------|
| Local frontend (`localhost:3000`) | Staging API + Staging Cognito |
| Vercel preview | Staging API + Staging Cognito |
| Staging DynamoDB | Separate test data |
| Production (`main`) | Production API + Production Cognito (untouched) |

---

## Step 6: Merge to Production

### 6.1 Pre-Merge Checklist

- [ ] All features tested on staging
- [ ] No `.env.local` changes committed (if using Vercel env scopes)
- [ ] If `.env.local` was committed, revert it to production values
- [ ] Backend deploys cleanly with `cdk deploy`
- [ ] No breaking changes to existing API contracts

### 6.2 Deploy Backend First (If Changed)

If your feature includes backend changes, deploy them **before** the frontend:

```bash
git checkout feature/<feature-name>
cd backend/cdk
cdk deploy TaskManagementStack    # <-- production stack, not staging
```

**Why backend first?** The old frontend won't call new endpoints, so nothing breaks. Once the backend is ready, the new frontend will find everything it needs.

### 6.3 Merge to Main

```bash
git checkout main
git pull origin main
git merge feature/<feature-name>
git push origin main
```

Vercel detects the push and auto-deploys the new frontend within ~1-2 minutes.

### 6.4 Run Migrations (If Needed)

If your feature changed **DynamoDB key structures or added indexes**, run migration scripts against the production table. See [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) for details.

### Deployment Order & Timeline

```
1. cdk deploy TaskManagementStack     → ~2-5 min (backend updated)
2. git push origin main               → ~1-2 min (Vercel rebuilds frontend)

Total: ~5 minutes, zero downtime
```

---

## Step 7: Cleanup Staging

Once the feature is merged and verified in production, tear down the staging stack:

```bash
cd backend/cdk
cdk destroy TaskManagementStagingStack --app "python app_staging.py"
```

This deletes all staging AWS resources. No ongoing cost.

Optionally delete the feature branch:

```bash
git branch -d feature/<feature-name>
git push origin --delete feature/<feature-name>
```

---

## What Happens to Production Users During Deployment?

### What Gets Updated (Code)

| Resource | Change |
|----------|--------|
| Lambda Functions | Replaced with new version |
| API Gateway | New routes added (if any) |
| Frontend | New build deployed |

### What Does NOT Change (Data)

| Resource | Status |
|----------|--------|
| DynamoDB Table | **Same table, same data, untouched** |
| Cognito User Pool | **Same users, same passwords, same sessions** |
| Active sessions | **Users stay logged in, no forced logout** |

### User Experience

| Moment | What Users See |
|--------|---------------|
| Before deploy | Everything works normally |
| During deploy (~2-5 min) | No downtime — AWS swaps Lambda versions atomically |
| After deploy | New features available, all existing data intact |

> AWS Lambda deployment is **atomic**. It doesn't stop the old version before starting the new one. It switches instantly. There is no "down" moment.

### Exception: Breaking Data Changes

If your new code **changes how existing data is read or written** (e.g., renaming a field from `title` to `name`), old data won't match the new code's expectations. In that case:

1. Write a migration script to update existing DynamoDB items
2. Run the migration **before** deploying the new code
3. See [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) for scripts and procedures

If you're only **adding new features** (new fields, new entities, new endpoints), existing data is 100% backward compatible and untouched.

---

## Quick Reference

```
# Start feature
git checkout -b feature/<name>

# Deploy staging backend
cd backend/cdk
cdk deploy TaskManagementStagingStack --app "python app_staging.py"

# Develop & test (repeat as needed)
cd frontend && npm run dev
cdk deploy TaskManagementStagingStack --app "python app_staging.py"

# Merge to production
cdk deploy TaskManagementStack                  # backend first
git checkout main && git merge feature/<name>   # then frontend
git push origin main

# Cleanup
cdk destroy TaskManagementStagingStack --app "python app_staging.py"
git branch -d feature/<name>
```
