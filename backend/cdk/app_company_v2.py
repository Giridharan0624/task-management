#!/usr/bin/env python3
import aws_cdk as cdk
from stack import TaskManagementStack

# Parallel V2 deployment on the company AWS profile (account 896823725438,
# ap-south-1). Fully isolated from the existing `taskflow` prod stack —
# every resource name carries a `-v2` suffix, and the awsApplication tag
# below points at a different resource group ARN, so the AWS console /
# Cost Explorer / IAM tag policies all see the two deployments as
# distinct applications.
#
# Frontend URL note: cors_origins / allowed_origin / app_url currently
# reuse the staging Vercel URL (Option A in COMPANY-V2-DEPLOYMENT-PLAN.md
# §4a). If the staging frontend is moved to a separate Vercel project
# (Option B), update these three fields before redeploying.
V2_CONFIG = {
    # taskflow.neurostack.in is the primary app domain now that the migrated
    # NEUROSTACK tenant lives on V2 and the frontend deploys there. It MUST be
    # listed: API Gateway echoes back only origins in this list, otherwise it
    # returns the first entry and the browser blocks every request at preflight
    # (login still works — Cognito SRP doesn't go through API Gateway — which
    # makes the failure look like "logged in but nothing loads").
    "cors_origins": [
        "https://taskflow.neurostack.in",
        "https://taskflow-ns.vercel.app",
        "http://localhost:3000",
    ],
    # `allowed_origin` is vestigial — nothing reads ALLOWED_ORIGIN (responses
    # send `*`); kept in sync to avoid misleading the next reader.
    "allowed_origin": "https://taskflow.neurostack.in",
    # `app_url` IS live: it's the base for invite/welcome email links
    # (org/handlers/send_invite.py, user/application/use_cases.py).
    "app_url": "https://taskflow.neurostack.in",
    "api_stage": "prod",
    "gmail_secret_name": "taskflow-v2/gmail-credentials",
    "groq_secret_name": "taskflow-v2/groq-api-key",
    "table_name": "TaskFlowTable-v2",
    "user_pool_name": "TaskFlowUserPool-v2",
    "user_pool_client_name": "TaskFlowClient-v2",
    "uploads_bucket_name": "taskflow-ns-uploads-v2-prod",
    # Integration platform deploys with V2 (the staging stack that
    # currently hosts it is being torn down — see
    # docs/planning/COMPANY-V2-DEPLOYMENT-PLAN.md §4b).
    # Owns its OWN dedicated REST API (separate hostname). Frontend
    # wires the new URL via NEXT_PUBLIC_INTEGRATIONS_API_URL — capture
    # the `IntegrationsApiUrl` CFN output after deploy.
    "integrations_enabled": True,
    # Self-service signup is OFF. V2 hosts the migrated NEUROSTACK tenant and
    # new workspaces must not be creatable from the public /signup route — the
    # route stays deployed but the handler returns 403. Users are added by
    # invite instead. Flip to True (or drop the key) to re-open signup.
    "signup_enabled": False,
    # AWS WAF v2 requires rate-based statement limits to be >=10. The
    # default in stack.py (5) was accepted by AWS when the existing
    # prod stack first deployed; bumping to 10 here for V2. Still
    # tight enough to block signup-bot floods — real human signups
    # don't approach 10 per IP per 5 min.
    "waf_signup_per_ip": 10,
    # Reserved Lambda concurrency stays OFF until a service-quota
    # increase confirms the company account has 120+ slots free in the
    # unreserved pool. Flip via env var on the integration Lambdas:
    # `_INTEGRATIONS_USE_RESERVED_CONCURRENCY=1` (see
    # nested/integrations_stack.py).
}

app = cdk.App()
stack = TaskManagementStack(
    app,
    "taskflow-v2",
    stage_config=V2_CONFIG,
    env=cdk.Environment(region="ap-south-1"),
)
cdk.Tags.of(stack).add(
    "awsApplication",
    "arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow-v2/05pduit0lnubyo3lv91e2n1l1f",
)
app.synth()
