#!/usr/bin/env python3
import aws_cdk as cdk
from stack import TaskManagementStack

COMPANY_CONFIG = {
    "cors_origins": ["https://taskflow.neurostack.in", "http://localhost:3000"],
    "allowed_origin": "https://taskflow.neurostack.in",
    "app_url": "https://taskflow.neurostack.in",
    "api_stage": "prod",
    "gmail_secret_name": "taskflow/gmail-credentials",
    "groq_secret_name": "taskflow/groq-api-key",
    "table_name": "TaskFlowTable",
    "user_pool_name": "TaskFlowUserPool",
    "user_pool_client_name": "TaskFlowClient",
    "uploads_bucket_name": "taskflow-ns-uploads-prod",
}

app = cdk.App()
stack = TaskManagementStack(
    app,
    "taskflow",
    stage_config=COMPANY_CONFIG,
    env=cdk.Environment(region="ap-south-1"),
)
cdk.Tags.of(stack).add("awsApplication", "arn:aws:resource-groups:ap-south-1:896823725438:group/taskflow/0eos9sfk62frvq2uhxwn7aw5z4")
app.synth()
