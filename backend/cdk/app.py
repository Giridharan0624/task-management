#!/usr/bin/env python3
import aws_cdk as cdk
from stack import TaskManagementStack

app = cdk.App()
TaskManagementStack(app, "task-management", env=cdk.Environment(region="ap-south-1"))
app.synth()
