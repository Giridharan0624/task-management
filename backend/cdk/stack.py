from pathlib import Path

import aws_cdk as cdk
from aws_cdk import (
    Stack,
    Duration,
    CfnOutput,
    RemovalPolicy,
    aws_dynamodb as dynamodb,
    aws_cognito as cognito,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_iam as iam,
    aws_secretsmanager as secretsmanager,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_events as events,
    aws_events_targets as events_targets,
)
from constructs import Construct

BACKEND_DIR = Path(__file__).resolve().parent.parent
LAMBDA_SRC = str(BACKEND_DIR / "src")
LAYERS_DIR = str(BACKEND_DIR / "layers")


DEFAULT_CONFIG = {
    "cors_origins": ["https://taskflow-ns.vercel.app", "http://localhost:3000"],
    "allowed_origin": "https://taskflow-ns.vercel.app",
    "app_url": "https://taskflow-ns.vercel.app",
    "api_stage": "prod",
    "gmail_secret_name": "taskflow/gmail-credentials",
    "table_name": "TaskManagementTable",
    "user_pool_name": "TaskManagementUserPool",
    "user_pool_client_name": "TaskManagementClient",
}


class TaskManagementStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, stage_config: dict | None = None, **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        config = stage_config or DEFAULT_CONFIG

        # ─── DynamoDB ────────────────────────────────────────────────────────
        table = dynamodb.Table(
            self,
            "Table",
            table_name=config["table_name"],
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True,
            removal_policy=RemovalPolicy.DESTROY,
        )

        table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=dynamodb.Attribute(name="GSI1PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI1SK", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        table.add_global_secondary_index(
            index_name="GSI2",
            partition_key=dynamodb.Attribute(name="GSI2PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="GSI2SK", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # ─── S3 (file uploads — avatars + task attachments) ─────────────────
        uploads_bucket = s3.Bucket(
            self,
            "UploadsBucket",
            bucket_name=f"taskflow-uploads-{config.get('api_stage', 'prod')}",
            encryption=s3.BucketEncryption.S3_MANAGED,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.RETAIN,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowed_origins=["*"],  # Presigned URLs are accessed from browser directly — origin varies
                    allowed_headers=["*"],
                    exposed_headers=["ETag"],
                    max_age=3600,
                )
            ],
            lifecycle_rules=[
                s3.LifecycleRule(
                    prefix="temp/",
                    expiration=Duration.days(1),  # Auto-delete temp uploads after 1 day
                ),
            ],
        )

        # ─── CloudFront CDN (serves uploaded files) ─────────────────────────
        cdn = cloudfront.Distribution(
            self,
            "UploadsCDN",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(uploads_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
        )

        # ─── Cognito ─────────────────────────────────────────────────────────
        user_pool = cognito.UserPool(
            self,
            "UserPool",
            user_pool_name=config["user_pool_name"],
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=False),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            custom_attributes={
                "systemRole": cognito.StringAttribute(min_len=1, max_len=20, mutable=True),
                "employeeId": cognito.StringAttribute(min_len=1, max_len=20, mutable=True),
            },
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_uppercase=True,
                require_lowercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            user_verification=cognito.UserVerificationConfig(
                email_subject="TaskFlow — Password Reset Code",
                email_body="Hi,\n\nYour TaskFlow password reset verification code is: {####}\n\nThis code is valid for one use only and expires shortly.\n\nIf you did not request this, please ignore this email.\n\nPowered by NEUROSTACK",
                email_style=cognito.VerificationEmailStyle.CODE,
            ),
            removal_policy=RemovalPolicy.DESTROY,
        )

        user_pool_client = user_pool.add_client(
            "UserPoolClient",
            user_pool_client_name=config["user_pool_client_name"],
            auth_flows=cognito.AuthFlow(
                user_srp=True,
                user_password=True,
            ),
            generate_secret=False,
            id_token_validity=Duration.days(1),
            access_token_validity=Duration.days(1),
            refresh_token_validity=Duration.days(30),
        )

        # ─── Cognito Authorizer ──────────────────────────────────────────────
        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
        )

        # ─── API Gateway ─────────────────────────────────────────────────────
        api = apigw.RestApi(
            self,
            "TaskManagementApi",
            rest_api_name="TaskManagementApi",
            deploy_options=apigw.StageOptions(stage_name=config["api_stage"]),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=config["cors_origins"],
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # ─── Lambda Layer (shared dependencies) ─────────────────────────────
        deps_layer = _lambda.LayerVersion(
            self,
            "DepsLayer",
            code=_lambda.Code.from_asset(LAYERS_DIR),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12],
            description="boto3, pydantic, and other shared dependencies",
        )

        # ─── Gmail Credentials (Secrets Manager) ────────────────────────────
        gmail_secret = secretsmanager.Secret(
            self,
            "GmailCredentials",
            secret_name=config["gmail_secret_name"],
            description="Gmail SMTP credentials for TaskFlow welcome emails",
            secret_string_value=cdk.SecretValue.unsafe_plain_text(
                '{"user":"giridharans0624@gmail.com","password":"mxhd sjrb rbny zexn"}'
            ),
        )

        # ─── Shared Lambda config ────────────────────────────────────────────
        lambda_env = {
            "TABLE_NAME": table.table_name,
            "USER_POOL_ID": user_pool.user_pool_id,
            "USER_POOL_CLIENT_ID": user_pool_client.user_pool_client_id,
            "ALLOWED_ORIGIN": config["allowed_origin"],
        }

        lambda_defaults = dict(
            runtime=_lambda.Runtime.PYTHON_3_12,
            code=_lambda.Code.from_asset(LAMBDA_SRC),
            timeout=Duration.seconds(10),
            environment=lambda_env,
            layers=[deps_layer],
        )

        # ─── Helper to create Lambda + API route ─────────────────────────────
        def add_api_lambda(
            name: str,
            handler: str,
            method: str,
            resource: apigw.IResource,
            cognito_policies: list[str] | None = None,
        ) -> _lambda.Function:
            fn = _lambda.Function(self, name, handler=handler, **lambda_defaults)
            table.grant_read_write_data(fn)

            if cognito_policies:
                fn.add_to_role_policy(
                    iam.PolicyStatement(
                        actions=cognito_policies,
                        resources=[user_pool.user_pool_arn],
                    )
                )

            resource.add_method(
                method,
                apigw.LambdaIntegration(fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )
            return fn

        # ─── API Resources ───────────────────────────────────────────────────
        projects = api.root.add_resource("projects")
        project = projects.add_resource("{projectId}")
        members = project.add_resource("members")
        member = members.add_resource("{userId}")
        member_role = member.add_resource("role")
        tasks = project.add_resource("tasks")
        task = tasks.add_resource("{taskId}")
        task_assign = task.add_resource("assign")
        comments = task.add_resource("comments")

        users = api.root.add_resource("users")
        users_me = users.add_resource("me")
        users_me_tasks = users_me.add_resource("tasks")
        user_by_id = users.add_resource("{userId}")
        user_progress = user_by_id.add_resource("progress")
        users_role = users.add_resource("role")
        users_department = users.add_resource("department")
        users_admins = users.add_resource("admins")

        # ─── Project handlers ────────────────────────────────────────────────
        add_api_lambda("CreateProject", "handlers.project.create_project.handler", "POST", projects)
        add_api_lambda("ListProjects", "handlers.project.list_projects.handler", "GET", projects)
        add_api_lambda("GetProject", "handlers.project.get_project.handler", "GET", project)
        add_api_lambda("UpdateProject", "handlers.project.update_project.handler", "PUT", project)
        add_api_lambda("DeleteProject", "handlers.project.delete_project.handler", "DELETE", project)
        project_status = project.add_resource("status")
        add_api_lambda("GetProjectStatus", "handlers.project.get_project_status.handler", "GET", project_status)
        add_api_lambda("AddMember", "handlers.project.add_member.handler", "POST", members)
        add_api_lambda("RemoveMember", "handlers.project.remove_member.handler", "DELETE", member)
        add_api_lambda("UpdateMemberRole", "handlers.project.update_member_role.handler", "PUT", member_role)

        # ─── Task handlers ───────────────────────────────────────────────────
        add_api_lambda("CreateTask", "handlers.task.create_task.handler", "POST", tasks)
        add_api_lambda("ListTasks", "handlers.task.list_tasks.handler", "GET", tasks)
        add_api_lambda("GetTask", "handlers.task.get_task.handler", "GET", task)
        add_api_lambda("UpdateTask", "handlers.task.update_task.handler", "PUT", task)
        add_api_lambda("DeleteTask", "handlers.task.delete_task.handler", "DELETE", task)
        add_api_lambda("AssignTask", "handlers.task.assign_task.handler", "PUT", task_assign)


        # ─── Comment handlers ────────────────────────────────────────────────
        add_api_lambda("CreateComment", "handlers.comment.create_comment.handler", "POST", comments)
        add_api_lambda("ListComments", "handlers.comment.list_comments.handler", "GET", comments)

        # ─── User handlers ───────────────────────────────────────────────────
        add_api_lambda("GetProfile", "handlers.user.get_profile.handler", "GET", users_me)
        add_api_lambda("UpdateProfile", "handlers.user.update_profile.handler", "PUT", users_me, cognito_policies=["cognito-idp:AdminUpdateUserAttributes"])
        add_api_lambda("MyTasks", "handlers.user.my_tasks.handler", "GET", users_me_tasks)
        add_api_lambda("ListUsers", "handlers.user.list_users.handler", "GET", users)

        # ─── User management (with Cognito admin permissions) ────────────────
        create_user_fn = add_api_lambda(
            "CreateUser",
            "handlers.user.create_user.handler",
            "POST",
            users,
            cognito_policies=["cognito-idp:AdminCreateUser"],
        )
        create_user_fn.add_environment("GMAIL_SECRET_ARN", gmail_secret.secret_arn)
        create_user_fn.add_environment("APP_URL", config["app_url"])
        gmail_secret.grant_read(create_user_fn)
        add_api_lambda(
            "DeleteUser",
            "handlers.user.delete_user.handler",
            "DELETE",
            user_by_id,
            cognito_policies=["cognito-idp:AdminDeleteUser"],
        )
        add_api_lambda(
            "UpdateUserRole",
            "handlers.user.update_user_role.handler",
            "PUT",
            users_role,
            cognito_policies=["cognito-idp:AdminUpdateUserAttributes"],
        )
        add_api_lambda("GetUserProgress", "handlers.user.get_user_progress.handler", "GET", user_progress)
        add_api_lambda("UpdateUserDepartment", "handlers.user.update_user_department.handler", "PUT", users_department)
        add_api_lambda("ListAdmins", "handlers.user.list_admins.handler", "GET", users_admins)

        # ─── Public endpoint (no auth) — resolve employee ID to email for login
        resolve_employee = api.root.add_resource("resolve-employee")
        resolve_fn = _lambda.Function(self, "ResolveEmployee", handler="handlers.user.resolve_employee.handler", **lambda_defaults)
        table.grant_read_data(resolve_fn)
        resolve_employee.add_method(
            "GET",
            apigw.LambdaIntegration(resolve_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # ─── Attendance handlers ────────────────────────────────────────────
        attendance = api.root.add_resource("attendance")
        attendance_sign_in = attendance.add_resource("sign-in")
        attendance_sign_out = attendance.add_resource("sign-out")
        attendance_me = attendance.add_resource("me")
        attendance_today = attendance.add_resource("today")

        add_api_lambda("AttendanceSignIn", "handlers.attendance.sign_in.handler", "POST", attendance_sign_in)
        add_api_lambda("AttendanceSignOut", "handlers.attendance.sign_out.handler", "PUT", attendance_sign_out)
        add_api_lambda("GetMyAttendance", "handlers.attendance.get_my_attendance.handler", "GET", attendance_me)
        add_api_lambda("ListTodayAttendance", "handlers.attendance.list_today_attendance.handler", "GET", attendance_today)
        attendance_report = attendance.add_resource("report")
        add_api_lambda("GetAttendanceReport", "handlers.attendance.get_report.handler", "GET", attendance_report)

        # ─── Day Off handlers ──────────────────────────────────────────────
        dayoffs = api.root.add_resource("day-offs")
        dayoffs_my = dayoffs.add_resource("my")
        dayoffs_pending = dayoffs.add_resource("pending")
        dayoffs_all = dayoffs.add_resource("all")
        dayoff_by_id = dayoffs.add_resource("{requestId}")
        dayoff_approve = dayoff_by_id.add_resource("approve")
        dayoff_reject = dayoff_by_id.add_resource("reject")
        dayoff_cancel = dayoff_by_id.add_resource("cancel")

        add_api_lambda("CreateDayOff", "handlers.dayoff.create_request.handler", "POST", dayoffs)
        add_api_lambda("MyDayOffs", "handlers.dayoff.my_requests.handler", "GET", dayoffs_my)
        add_api_lambda("PendingDayOffs", "handlers.dayoff.pending_approvals.handler", "GET", dayoffs_pending)
        add_api_lambda("AllDayOffs", "handlers.dayoff.all_requests.handler", "GET", dayoffs_all)
        add_api_lambda("ApproveDayOff", "handlers.dayoff.approve.handler", "PUT", dayoff_approve)
        add_api_lambda("RejectDayOff", "handlers.dayoff.reject.handler", "PUT", dayoff_reject)
        add_api_lambda("CancelDayOff", "handlers.dayoff.cancel.handler", "PUT", dayoff_cancel)

        # ─── Activity handlers (desktop app heartbeats) ───────────────────
        activity = api.root.add_resource("activity")
        activity_heartbeat = activity.add_resource("heartbeat")
        activity_me = activity.add_resource("me")
        activity_report = activity.add_resource("report")

        add_api_lambda("PostHeartbeat", "handlers.activity.post_heartbeat.handler", "POST", activity_heartbeat)
        add_api_lambda("GetMyActivity", "handlers.activity.get_my_activity.handler", "GET", activity_me)
        add_api_lambda("GetActivityReport", "handlers.activity.get_report.handler", "GET", activity_report)

        # Activity AI summary
        activity_summary = activity.add_resource("summary")
        groq_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "GroqApiKey", config.get("groq_secret_name", "taskflow/groq-api-key")
        )
        generate_summary_fn = add_api_lambda(
            "GenerateSummary", "handlers.activity.generate_summary.handler", "POST", activity_summary
        )
        generate_summary_fn.add_environment("GROQ_SECRET_ARN", groq_secret.secret_arn)
        groq_secret.grant_read(generate_summary_fn)
        # AI calls need more time than the default 10s
        generate_summary_fn.node.default_child.add_property_override("Timeout", 60)

        add_api_lambda("GetSummary", "handlers.activity.get_summary.handler", "GET", activity_summary)

        # Scheduled: auto-generate AI summaries at 11:30 PM IST (18:00 UTC) daily
        auto_summary_fn = _lambda.Function(
            self, "AutoGenerateSummaries",
            handler="handlers.activity.auto_generate_summaries.handler",
            **{**lambda_defaults, "timeout": Duration.minutes(5)},
        )
        auto_summary_fn.add_environment("GROQ_SECRET_ARN", groq_secret.secret_arn)
        groq_secret.grant_read(auto_summary_fn)
        table.grant_read_write_data(auto_summary_fn)

        events.Rule(
            self, "DailySummarySchedule",
            schedule=events.Schedule.cron(hour="18", minute="0"),  # 11:30 PM IST = 18:00 UTC
            targets=[events_targets.LambdaFunction(auto_summary_fn)],
        )

        # ─── Upload handlers (S3 presigned URLs) ──────────────────────────
        uploads = api.root.add_resource("uploads")
        uploads_presign = uploads.add_resource("presign")

        presign_fn = add_api_lambda("GetPresignedUrl", "handlers.upload.presign.handler", "GET", uploads_presign)
        presign_fn.add_environment("UPLOADS_BUCKET", uploads_bucket.bucket_name)
        presign_fn.add_environment("CDN_DOMAIN", cdn.distribution_domain_name)
        uploads_bucket.grant_put(presign_fn)

        # ─── Task Update handlers ──────────────────────────────────────────
        task_updates = api.root.add_resource("task-updates")
        task_updates_me = task_updates.add_resource("me")

        add_api_lambda("SubmitTaskUpdate", "handlers.taskupdate.submit_update.handler", "POST", task_updates)
        add_api_lambda("ListTaskUpdates", "handlers.taskupdate.list_updates.handler", "GET", task_updates)
        add_api_lambda("MyTaskUpdate", "handlers.taskupdate.my_update.handler", "GET", task_updates_me)

        # ─── Outputs ─────────────────────────────────────────────────────────
        CfnOutput(self, "ApiUrl", value=api.url, description="API Gateway endpoint URL")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id, description="Cognito User Pool ID")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id, description="Cognito Client ID")
        CfnOutput(self, "TableName", value=table.table_name, description="DynamoDB Table Name")
        CfnOutput(self, "UploadsBucketName", value=uploads_bucket.bucket_name, description="S3 uploads bucket")
        CfnOutput(self, "CDNDomain", value=cdn.distribution_domain_name, description="CloudFront CDN domain")
