"""Nested stack for the task + comment bounded contexts.

Carved out of the parent stack to free CFN resource budget. Same pattern
as OrgNestedStack and WorkflowNestedStack — the parent passes the
shared infrastructure (RestApi root, authorizer, table, deps layer)
plus the API Gateway resources whose Methods we own, and the nested
stack creates the Lambdas + their Methods.

What's INSIDE this nested stack:
  - CreateTask, GetTask, UpdateTask, DeleteTask, AssignTask
  - CreateComment

What's OUTSIDE (parent owns):
  - The /projects/{projectId}/tasks /tasks/{taskId} /assign /comments
    Resource tree (Resources stay with the parent because they're shared
    with other handlers that haven't been migrated yet).
  - DynamoDB Table, Cognito UserPool, S3 bucket, deps Lambda layer.

CFN savings vs. keeping these handlers in the parent: each handler is
~5 CFN resources (Lambda Function + IAM Role + IAM Policy + Lambda
Permission + API Gateway Method). 6 handlers × ~5 = ~30 resources,
minus the 1 AWS::CloudFormation::Stack reference this nested stack
itself adds back to the parent. Net: parent stack drops by ~29 CFN
resources.
"""
from __future__ import annotations

from aws_cdk import (
    Duration,
    NestedStack,
    aws_apigateway as apigw,
    aws_dynamodb as dynamodb,
    aws_lambda as _lambda,
    aws_logs as logs,
)
from constructs import Construct


class CoreNestedStack(NestedStack):
    """Holds the task + comment bounded-context handlers."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        api: apigw.RestApi,
        authorizer: apigw.CognitoUserPoolsAuthorizer,
        table: dynamodb.ITable,
        deps_layer: _lambda.ILayerVersion,
        lambda_src: str,
        lambda_env: dict,
        log_retention: logs.RetentionDays = logs.RetentionDays.THREE_MONTHS,
        # API GW resources owned by the parent — Methods we add to these
        # land in this nested stack (CDK puts the Method in the construct
        # scope where add_method is called). Resources stay where they
        # were created.
        tasks_resource: apigw.IResource,
        task_resource: apigw.IResource,
        task_assign_resource: apigw.IResource,
        comments_resource: apigw.IResource,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Shared Lambda defaults ──────────────────────────────────────
        # Mirror the parent's lambda_defaults shape so behavior is
        # identical regardless of which stack the function lives in.
        lambda_defaults = dict(
            runtime=_lambda.Runtime.PYTHON_3_12,
            code=_lambda.Code.from_asset(lambda_src),
            timeout=Duration.seconds(10),
            environment=lambda_env,
            layers=[deps_layer],
            log_retention=log_retention,
        )

        def add_api_lambda(
            name: str,
            handler: str,
            method: str,
            resource: apigw.IResource,
        ) -> _lambda.Function:
            fn = _lambda.Function(self, name, handler=handler, **lambda_defaults)
            table.grant_read_write_data(fn)
            resource.add_method(
                method,
                apigw.LambdaIntegration(fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )
            return fn

        # ── Task context handlers ───────────────────────────────────────
        add_api_lambda(
            "CreateTask",
            "contexts.task.handlers.create_task.handler",
            "POST",
            tasks_resource,
        )
        add_api_lambda(
            "GetTask",
            "contexts.task.handlers.get_task.handler",
            "GET",
            task_resource,
        )
        add_api_lambda(
            "UpdateTask",
            "contexts.task.handlers.update_task.handler",
            "PUT",
            task_resource,
        )
        add_api_lambda(
            "DeleteTask",
            "contexts.task.handlers.delete_task.handler",
            "DELETE",
            task_resource,
        )
        add_api_lambda(
            "AssignTask",
            "contexts.task.handlers.assign_task.handler",
            "PUT",
            task_assign_resource,
        )

        # ── Comment context handlers ────────────────────────────────────
        add_api_lambda(
            "CreateComment",
            "contexts.comment.handlers.create_comment.handler",
            "POST",
            comments_resource,
        )
