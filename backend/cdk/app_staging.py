#!/usr/bin/env python3
import aws_cdk as cdk
from stack import TaskManagementStack

STAGING_CONFIG = {
    "cors_origins": ["http://localhost:3000"],
    "allowed_origin": "http://localhost:3000",
    "app_url": "http://localhost:3000",
    "api_stage": "staging",
    "gmail_secret_name": "taskflow-staging/gmail-credentials",
    "table_name": "TaskManagementTable-staging",
    "user_pool_name": "TaskManagementUserPool-staging",
    "user_pool_client_name": "TaskManagementClient-staging",
}

app = cdk.App()
TaskManagementStack(
    app,
    "task-management-staging",
    stage_config=STAGING_CONFIG,
    env=cdk.Environment(region="ap-south-1"),
)
app.synth()
