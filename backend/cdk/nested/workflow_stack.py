"""Nested stack for team-workflow handlers (attendance + day-offs).

Carved out alongside `OrgNestedStack` to claw back more parent-stack
resource budget. Each Lambda we move out trims function + role + policy
from the parent (~3 resources per handler). Attendance and day-offs are
isolated, well-bounded contexts with no exotic cross-cutting deps —
ideal candidates for relocation.

API Gateway methods/resources stay in the parent (they live on api.root
which is parent-owned); only Lambdas, IAM bits, and the Permission
resources move here.
"""
from __future__ import annotations

from aws_cdk import (
    Duration,
    NestedStack,
    aws_apigateway as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    aws_lambda as _lambda,
    aws_logs as logs,
)
from constructs import Construct


class WorkflowNestedStack(NestedStack):
    """Holds attendance + day-off handlers."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        api: apigw.RestApi,
        authorizer: apigw.CognitoUserPoolsAuthorizer,
        table: dynamodb.ITable,
        user_pool: cognito.IUserPool,
        deps_layer: _lambda.ILayerVersion,
        lambda_src: str,
        lambda_env: dict,
        log_retention: logs.RetentionDays = logs.RetentionDays.THREE_MONTHS,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        lambda_defaults = dict(
            runtime=_lambda.Runtime.PYTHON_3_12,
            code=_lambda.Code.from_asset(lambda_src),
            timeout=Duration.seconds(10),
            environment=lambda_env,
            layers=[deps_layer],
            log_retention=log_retention,
        )

        def add_api_lambda(
            name: str, handler: str, method: str, resource: apigw.IResource,
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

        # ── Attendance ────────────────────────────────────────────────
        attendance = api.root.add_resource("attendance")
        attendance_sign_in = attendance.add_resource("sign-in")
        attendance_sign_out = attendance.add_resource("sign-out")
        attendance_me = attendance.add_resource("me")
        attendance_today = attendance.add_resource("today")
        attendance_report = attendance.add_resource("report")

        add_api_lambda("AttendanceSignIn", "contexts.attendance.handlers.sign_in.handler", "POST", attendance_sign_in)
        add_api_lambda("AttendanceSignOut", "contexts.attendance.handlers.sign_out.handler", "PUT", attendance_sign_out)
        add_api_lambda("GetMyAttendance", "contexts.attendance.handlers.get_my_attendance.handler", "GET", attendance_me)
        add_api_lambda("ListTodayAttendance", "contexts.attendance.handlers.list_today_attendance.handler", "GET", attendance_today)
        add_api_lambda("GetAttendanceReport", "contexts.attendance.handlers.get_report.handler", "GET", attendance_report)

        # ── Day-offs ──────────────────────────────────────────────────
        dayoffs = api.root.add_resource("day-offs")
        # `MyDayOffs` doubles as the balance endpoint via `?view=balance` to
        # avoid burning another API Gateway resource/method/permission triplet
        # against the parent stack's 500-resource CFN cap. See
        # contexts/dayoff/handlers/my_requests.py for the dispatch logic.
        dayoffs_my = dayoffs.add_resource("my")
        dayoffs_pending = dayoffs.add_resource("pending")
        dayoffs_all = dayoffs.add_resource("all")
        dayoff_by_id = dayoffs.add_resource("{requestId}")
        dayoff_approve = dayoff_by_id.add_resource("approve")
        dayoff_reject = dayoff_by_id.add_resource("reject")
        dayoff_cancel = dayoff_by_id.add_resource("cancel")

        add_api_lambda("CreateDayOff", "contexts.dayoff.handlers.create_request.handler", "POST", dayoffs)
        add_api_lambda("MyDayOffs", "contexts.dayoff.handlers.my_requests.handler", "GET", dayoffs_my)
        add_api_lambda("PendingDayOffs", "contexts.dayoff.handlers.pending_approvals.handler", "GET", dayoffs_pending)
        add_api_lambda("AllDayOffs", "contexts.dayoff.handlers.all_requests.handler", "GET", dayoffs_all)
        add_api_lambda("ApproveDayOff", "contexts.dayoff.handlers.approve.handler", "PUT", dayoff_approve)
        add_api_lambda("RejectDayOff", "contexts.dayoff.handlers.reject.handler", "PUT", dayoff_reject)
        add_api_lambda("CancelDayOff", "contexts.dayoff.handlers.cancel.handler", "PUT", dayoff_cancel)
