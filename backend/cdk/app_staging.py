#!/usr/bin/env python3
import aws_cdk as cdk
from stack import TaskManagementStack

STAGING_CONFIG = {
    "cors_origins": [
        "https://taskflow-ns.vercel.app",
        "http://localhost:3000",
    ],
    "allowed_origin": "https://taskflow-ns.vercel.app",
    "app_url": "https://taskflow-ns.vercel.app",
    "api_stage": "staging",
    "gmail_secret_name": "taskflow-staging/gmail-credentials",
    "groq_secret_name": "taskflow-staging/groq-api-key",
    "table_name": "TaskManagementTable-staging",
    "user_pool_name": "TaskManagementUserPool-staging",
    "user_pool_client_name": "TaskManagementClient-staging",
    # Phase 1P — integration platform deployed on staging only.
    # Production app.py / app_company.py do NOT set this flag, so the
    # IntegrationsNestedStack is not synthesized for prod stacks until
    # the explicit cut-over step (Phase 1e.3).
    "integrations_enabled": True,
}

app = cdk.App()
TaskManagementStack(
    app,
    "task-management-staging",
    stage_config=STAGING_CONFIG,
    env=cdk.Environment(region="ap-south-1"),
)
app.synth()
