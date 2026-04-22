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
    aws_cloudwatch as cloudwatch,
    aws_events as events,
    aws_events_targets as events_targets,
    aws_logs as logs,
    aws_wafv2 as wafv2,
)
from constructs import Construct

from nested.org_stack import OrgNestedStack
from nested.workflow_stack import WorkflowNestedStack

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
    # Phase 6 — WAF rate limits (5-minute sliding window).
    # `per_workspace` keys on the `x-org-slug` header. Requests without
    # the header skip this rule and fall through to `per_ip`. Tune in
    # config overrides per stage; staging uses a generous ceiling.
    "waf_rate_per_workspace": 2000,
    "waf_rate_per_ip": 5000,
}


class TaskManagementStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, stage_config: dict | None = None, **kwargs):
        super().__init__(scope, construct_id, **kwargs)
        config = stage_config or DEFAULT_CONFIG

        # Removal policy: RETAIN for any stage that isn't the disposable
        # staging environment. Prevents `cdk destroy` or stack drift from
        # accidentally wiping the DynamoDB table or Cognito pool in prod.
        is_staging = config.get("api_stage") == "staging"
        data_removal_policy = (
            RemovalPolicy.DESTROY if is_staging else RemovalPolicy.RETAIN
        )

        # ─── DynamoDB ────────────────────────────────────────────────────────
        # PITR: enabled on both stages. Staging gets a shorter retention
        # (7 days) because it's disposable; prod keeps the 35-day max for
        # real recovery scenarios. `pointInTimeRecoverySpecification` is
        # the non-deprecated form — `point_in_time_recovery=True` still
        # works but emits a warning on every synth.
        pitr_days = 7 if is_staging else 35
        table = dynamodb.Table(
            self,
            "Table",
            table_name=config["table_name"],
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True,
                recovery_period_in_days=pitr_days,
            ),
            removal_policy=data_removal_policy,
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
            bucket_name=config.get("uploads_bucket_name", f"taskflow-uploads-{config.get('api_stage', 'prod')}"),
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
                # Phase 1 multi-tenant: every user belongs to exactly one org.
                # mutable=True so the one-time backfill can retroactively set
                # orgId on existing NEUROSTACK users. Application code treats
                # this as immutable post-creation — only the signup handler
                # and the backfill script ever write it.
                "orgId": cognito.StringAttribute(min_len=1, max_len=64, mutable=True),
            },
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_uppercase=True,
                require_lowercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            user_verification=cognito.UserVerificationConfig(
                # This template is used for BOTH password-reset codes
                # (ForgotPassword flow) and email-attribute verification
                # codes (VerifyUserAttribute flow). Cognito doesn't let
                # us disambiguate, so the copy stays generic.
                email_subject="TaskFlow — Verification Code",
                email_body=(
                    "Hi,\n\n"
                    "Your TaskFlow verification code is: {####}\n\n"
                    "This code is valid for one use only and expires shortly.\n\n"
                    "If you did not request this, please ignore this email."
                ),
                email_style=cognito.VerificationEmailStyle.CODE,
            ),
            removal_policy=data_removal_policy,
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
        gmail_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "GmailCredentials", config["gmail_secret_name"]
        )

        # ─── Shared Lambda config ────────────────────────────────────────────
        lambda_env = {
            "TABLE_NAME": table.table_name,
            "USER_POOL_ID": user_pool.user_pool_id,
            "USER_POOL_CLIENT_ID": user_pool_client.user_pool_client_id,
            "ALLOWED_ORIGIN": config["allowed_origin"],
        }

        # Log retention policy: 90 days on staging, 365 days on prod.
        # Passed into the nested stacks so every handler that lives there
        # gets a retention-bounded log group automatically. NOT applied
        # on parent-side Lambdas: each `log_retention` kwarg emits a
        # `Custom::LogRetention` helper resource, and 40 of those would
        # push the parent over the 500-resource CFN cap. Parent-side
        # Lambdas fall back to the CloudWatch default (never-expire) —
        # accept until they move into a future nested stack.
        log_retention = (
            logs.RetentionDays.THREE_MONTHS if is_staging
            else logs.RetentionDays.ONE_YEAR
        )

        lambda_defaults = dict(
            runtime=_lambda.Runtime.PYTHON_3_12,
            code=_lambda.Code.from_asset(LAMBDA_SRC),
            timeout=Duration.seconds(10),
            environment=lambda_env,
            layers=[deps_layer],
        )

        # ─── Pre-token-generation trigger (multi-tenant claim injection) ────
        # Runs on every Cognito token issuance. Injects custom:orgId and
        # custom:systemRole into the ID token so AuthContext can read them
        # without a per-request DB round-trip. Attached to the UserPool
        # declared above.
        pre_token_fn = _lambda.Function(
            self,
            "PreTokenTrigger",
            handler="contexts.org.handlers.pre_token_trigger.handler",
            runtime=_lambda.Runtime.PYTHON_3_12,
            code=_lambda.Code.from_asset(LAMBDA_SRC),
            timeout=Duration.seconds(5),
            environment={"TABLE_NAME": table.table_name},
            layers=[deps_layer],
        )
        table.grant_read_data(pre_token_fn)
        user_pool.add_trigger(
            cognito.UserPoolOperation.PRE_TOKEN_GENERATION,
            pre_token_fn,
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
        users_birthdays = users.add_resource("birthdays")

        # ─── Project handlers ────────────────────────────────────────────────
        add_api_lambda("CreateProject", "contexts.project.handlers.create_project.handler", "POST", projects)
        add_api_lambda("ListProjects", "contexts.project.handlers.list_projects.handler", "GET", projects)
        add_api_lambda("GetProject", "contexts.project.handlers.get_project.handler", "GET", project)
        add_api_lambda("UpdateProject", "contexts.project.handlers.update_project.handler", "PUT", project)
        add_api_lambda("DeleteProject", "contexts.project.handlers.delete_project.handler", "DELETE", project)
        project_status = project.add_resource("status")
        add_api_lambda("GetProjectStatus", "contexts.project.handlers.get_project_status.handler", "GET", project_status)
        add_api_lambda("AddMember", "contexts.project.handlers.add_member.handler", "POST", members)
        add_api_lambda("RemoveMember", "contexts.project.handlers.remove_member.handler", "DELETE", member)
        add_api_lambda("UpdateMemberRole", "contexts.project.handlers.update_member_role.handler", "PUT", member_role)

        # ─── Task handlers ───────────────────────────────────────────────────
        add_api_lambda("CreateTask", "contexts.task.handlers.create_task.handler", "POST", tasks)
        add_api_lambda("ListTasks", "contexts.task.handlers.list_tasks.handler", "GET", tasks)
        add_api_lambda("GetTask", "contexts.task.handlers.get_task.handler", "GET", task)
        add_api_lambda("UpdateTask", "contexts.task.handlers.update_task.handler", "PUT", task)
        add_api_lambda("DeleteTask", "contexts.task.handlers.delete_task.handler", "DELETE", task)
        add_api_lambda("AssignTask", "contexts.task.handlers.assign_task.handler", "PUT", task_assign)


        # ─── Comment handlers ────────────────────────────────────────────────
        add_api_lambda("CreateComment", "contexts.comment.handlers.create_comment.handler", "POST", comments)
        add_api_lambda("ListComments", "contexts.comment.handlers.list_comments.handler", "GET", comments)

        # ─── User handlers ───────────────────────────────────────────────────
        add_api_lambda("GetProfile", "contexts.user.handlers.get_profile.handler", "GET", users_me)
        add_api_lambda("UpdateProfile", "contexts.user.handlers.update_profile.handler", "PUT", users_me, cognito_policies=["cognito-idp:AdminUpdateUserAttributes"])
        add_api_lambda("MyTasks", "contexts.user.handlers.my_tasks.handler", "GET", users_me_tasks)
        add_api_lambda("ListUsers", "contexts.user.handlers.list_users.handler", "GET", users)

        # ─── User management (with Cognito admin permissions) ────────────────
        create_user_fn = add_api_lambda(
            "CreateUser",
            "contexts.user.handlers.create_user.handler",
            "POST",
            users,
            cognito_policies=["cognito-idp:AdminCreateUser"],
        )
        create_user_fn.add_environment("GMAIL_SECRET_ARN", gmail_secret.secret_arn)
        create_user_fn.add_environment("APP_URL", config["app_url"])
        gmail_secret.grant_read(create_user_fn)

        # ─── Bulk user import (CSV-driven) ───────────────────────────────
        # Iterates the single-user CreateUserUseCase in a loop; longer
        # timeout because 200 users × ~200ms Cognito+DDB each ≈ 40s.
        # Same IAM permissions as create_user — reuses its flow.
        users_bulk = users.add_resource("bulk")
        bulk_create_fn = _lambda.Function(
            self, "BulkCreateUsers",
            handler="contexts.user.handlers.bulk_create_users.handler",
            **{**lambda_defaults, "timeout": Duration.seconds(60)},
        )
        table.grant_read_write_data(bulk_create_fn)
        bulk_create_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["cognito-idp:AdminCreateUser"],
                resources=[user_pool.user_pool_arn],
            )
        )
        bulk_create_fn.add_environment("GMAIL_SECRET_ARN", gmail_secret.secret_arn)
        bulk_create_fn.add_environment("APP_URL", config["app_url"])
        gmail_secret.grant_read(bulk_create_fn)
        users_bulk.add_method(
            "POST",
            apigw.LambdaIntegration(bulk_create_fn),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )
        add_api_lambda(
            "DeleteUser",
            "contexts.user.handlers.delete_user.handler",
            "DELETE",
            user_by_id,
            cognito_policies=["cognito-idp:AdminDeleteUser"],
        )
        add_api_lambda(
            "UpdateUserRole",
            "contexts.user.handlers.update_user_role.handler",
            "PUT",
            users_role,
            cognito_policies=["cognito-idp:AdminUpdateUserAttributes"],
        )
        add_api_lambda("GetUserProgress", "contexts.user.handlers.get_user_progress.handler", "GET", user_progress)
        add_api_lambda("UpdateUserDepartment", "contexts.user.handlers.update_user_department.handler", "PUT", users_department)
        add_api_lambda("ListAdmins", "contexts.user.handlers.list_admins.handler", "GET", users_admins)
        add_api_lambda("GetBirthdays", "contexts.user.handlers.get_birthdays.handler", "GET", users_birthdays)

        # ─── Public endpoint (no auth) — resolve employee ID to email for login
        resolve_employee = api.root.add_resource("resolve-employee")
        resolve_fn = _lambda.Function(self, "ResolveEmployee", handler="contexts.user.handlers.resolve_employee.handler", **lambda_defaults)
        table.grant_read_data(resolve_fn)
        resolve_employee.add_method(
            "GET",
            apigw.LambdaIntegration(resolve_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # ─── Health check (no auth) — liveness/readiness probe ─────────
        # Uptime monitors and load balancers hit this. Uses the same
        # Lambda defaults as the rest, so a cold start still resolves
        # in the same time as any other handler.
        health_resource = api.root.add_resource("health")
        health_fn = _lambda.Function(
            self, "HealthCheck",
            handler="contexts.system.handlers.health.handler",
            **lambda_defaults,
        )
        table.grant_read_data(health_fn)
        health_resource.add_method(
            "GET",
            apigw.LambdaIntegration(health_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # ─── Platform-operator endpoints (auth required + env allowlist)
        # These are NOT tenant-facing — only a human operator at Anthropic
        # should ever hit these. Access gated by PLATFORM_ADMIN_USER_IDS
        # (comma-separated Cognito sub list). Empty env = nobody can call.
        platform_admin_ids = config.get("platform_admin_user_ids", "")
        platform = api.root.add_resource("platform")
        platform_orgs = platform.add_resource("orgs")
        platform_org = platform_orgs.add_resource("{orgId}")
        platform_org_status = platform_org.add_resource("status")
        set_status_fn = add_api_lambda(
            "SetOrgStatus",
            "contexts.org.handlers.set_org_status.handler",
            "POST",
            platform_org_status,
        )
        set_status_fn.add_environment(
            "PLATFORM_ADMIN_USER_IDS", platform_admin_ids,
        )

        # ─── Organization (multi-tenant) handlers — nested stack ────────────
        # Every org-context Lambda + admin handler lives in its own
        # NestedStack so the parent stays well under the 500-resource
        # CloudFormation cap. The parent owns the data resources (table,
        # user pool, bucket) and the API Gateway construct; the nested
        # stack adds Lambdas + routes via api.root.add_resource(...) which
        # CDK wires across stacks automatically through CFN imports.
        OrgNestedStack(
            self,
            "Org",
            api=api,
            authorizer=authorizer,
            table=table,
            user_pool=user_pool,
            deps_layer=deps_layer,
            lambda_src=LAMBDA_SRC,
            lambda_env=lambda_env,
            gmail_secret=gmail_secret,
            app_url=config["app_url"],
            log_retention=log_retention,
            hcaptcha_secret_value=config.get("hcaptcha_secret", ""),
        )

        # ─── Attendance + Day-off handlers (nested) ─────────────────────────
        # Same pattern as OrgNestedStack: free CFN resource budget by
        # putting these context handlers in their own nested stack.
        WorkflowNestedStack(
            self,
            "Workflow",
            api=api,
            authorizer=authorizer,
            table=table,
            user_pool=user_pool,
            deps_layer=deps_layer,
            lambda_src=LAMBDA_SRC,
            lambda_env=lambda_env,
            log_retention=log_retention,
        )

        # ─── Activity handlers (desktop app heartbeats) ───────────────────
        activity = api.root.add_resource("activity")
        activity_heartbeat = activity.add_resource("heartbeat")
        activity_me = activity.add_resource("me")
        activity_report = activity.add_resource("report")

        add_api_lambda("PostHeartbeat", "contexts.activity.handlers.post_heartbeat.handler", "POST", activity_heartbeat)
        add_api_lambda("GetMyActivity", "contexts.activity.handlers.get_my_activity.handler", "GET", activity_me)
        add_api_lambda("GetActivityReport", "contexts.activity.handlers.get_report.handler", "GET", activity_report)

        # Activity AI summary
        activity_summary = activity.add_resource("summary")
        groq_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "GroqApiKey", config.get("groq_secret_name", "taskflow/groq-api-key")
        )
        generate_summary_fn = add_api_lambda(
            "GenerateSummary", "contexts.activity.handlers.generate_summary.handler", "POST", activity_summary
        )
        generate_summary_fn.add_environment("GROQ_SECRET_ARN", groq_secret.secret_arn)
        groq_secret.grant_read(generate_summary_fn)
        # AI calls need more time than the default 10s
        generate_summary_fn.node.default_child.add_property_override("Timeout", 60)

        add_api_lambda("GetSummary", "contexts.activity.handlers.get_summary.handler", "GET", activity_summary)

        # Scheduled: auto-generate AI summaries at 11:30 PM IST (18:00 UTC) daily
        auto_summary_fn = _lambda.Function(
            self, "AutoGenerateSummaries",
            handler="contexts.activity.handlers.auto_generate_summaries.handler",
            **{**lambda_defaults, "timeout": Duration.minutes(5)},
        )
        auto_summary_fn.add_environment("GROQ_SECRET_ARN", groq_secret.secret_arn)
        groq_secret.grant_read(auto_summary_fn)
        table.grant_read_write_data(auto_summary_fn)
        events.Rule(
            self, "DailySummarySchedule",
            schedule=events.Schedule.cron(hour="18", minute="0"),
            targets=[events_targets.LambdaFunction(auto_summary_fn)],
        )

        # ─── Stale-session sweeper (Phase 6 hardening) ─────────────────────
        # The desktop client auto-signs-out on every termination path it
        # can observe (tray Quit, Wails OnShutdown, SIGTERM/SIGINT). It
        # cannot catch force-kill / power-loss scenarios, so a sweeper
        # Lambda closes abandoned sessions at the last proof-of-life
        # timestamp (session.last_heartbeat_at, stamped by every
        # /activity/heartbeat call — see contexts/attendance/application/
        # sweep_use_case.py for the detection logic).
        #
        # Budget: small-table scan once every 5 minutes per tenant —
        # negligible at current tenant count. The schedule is identical
        # in staging and prod; grace-minutes can diverge via the env
        # var.
        sweep_fn = _lambda.Function(
            self, "SweepStaleSessions",
            handler="contexts.attendance.handlers.sweep_stale_sessions.handler",
            **{**lambda_defaults, "timeout": Duration.minutes(2)},
        )
        sweep_fn.add_environment(
            "STALE_SESSION_GRACE_MINUTES",
            str(config.get("stale_session_grace_minutes", 15)),
        )
        table.grant_read_write_data(sweep_fn)
        events.Rule(
            self, "StaleSessionSweepSchedule",
            schedule=events.Schedule.rate(Duration.minutes(5)),
            targets=[events_targets.LambdaFunction(sweep_fn)],
        )

        # ─── Upload handlers (S3 presigned URLs) ──────────────────────────
        uploads = api.root.add_resource("uploads")
        uploads_presign = uploads.add_resource("presign")

        presign_fn = add_api_lambda("GetPresignedUrl", "contexts.upload.handlers.presign.handler", "GET", uploads_presign)
        presign_fn.add_environment("UPLOADS_BUCKET", uploads_bucket.bucket_name)
        presign_fn.add_environment("CDN_DOMAIN", cdn.distribution_domain_name)
        uploads_bucket.grant_put(presign_fn)

        # ─── Task Update handlers ──────────────────────────────────────────
        task_updates = api.root.add_resource("task-updates")
        task_updates_me = task_updates.add_resource("me")

        add_api_lambda("SubmitTaskUpdate", "contexts.taskupdate.handlers.submit_update.handler", "POST", task_updates)
        add_api_lambda("ListTaskUpdates", "contexts.taskupdate.handlers.list_updates.handler", "GET", task_updates)
        add_api_lambda("MyTaskUpdate", "contexts.taskupdate.handlers.my_update.handler", "GET", task_updates_me)

        # ─── Weekly rollup (AI-assisted digest of task updates) ────────────
        # Reuses the Groq secret already provisioned above for the activity
        # summary. Longer timeout than the default 10s because the call
        # chain is: DynamoDB range-query (7 days) → Groq completion → parse.
        task_updates_weekly = task_updates.add_resource("weekly-rollup")
        weekly_rollup_fn = add_api_lambda(
            "WeeklyRollup",
            "contexts.taskupdate.handlers.weekly_rollup.handler",
            "GET",
            task_updates_weekly,
        )
        weekly_rollup_fn.add_environment("GROQ_SECRET_ARN", groq_secret.secret_arn)
        groq_secret.grant_read(weekly_rollup_fn)
        weekly_rollup_fn.node.default_child.add_property_override("Timeout", 60)

        # ─── WAFv2 — per-tenant + per-IP rate limits (Phase 6) ──────────────
        # Skipped in staging to keep us under the 500-resource CFN cap and
        # because WAF metrics on a low-traffic test environment are noise.
        # Prod gets the protection.
        if not is_staging:
            # Two rate-based rules in priority order:
            #   1. PerWorkspaceRate — keys on the `x-org-slug` header so a
            #      single noisy tenant cannot exhaust the global quota for
            #      everyone else. Requests without the header (public
            #      signup, legacy clients) skip this rule and fall through
            #      to PerIpRate.
            #   2. PerIpRate — global per-IP ceiling, catches credential-
            #      stuffing / scraping that rotates orgs but stays on one IP.
            # Both windows are WAF's fixed 5-minute sliding window. Action
            # is BLOCK; switch to COUNT temporarily if a rollout looks
            # misconfigured.
            per_ws_limit = int(config.get("waf_rate_per_workspace", 2000))
            per_ip_limit = int(config.get("waf_rate_per_ip", 5000))
            # Signup is the highest-leverage abuse target — one POST creates
            # an entire tenant. Cap it tight (5 / 5-min / IP). Ordinary
            # human signups don't approach this; bots flood it.
            signup_limit = int(config.get("waf_signup_per_ip", 5))

            web_acl = wafv2.CfnWebACL(
                self,
                "ApiWebAcl",
                scope="REGIONAL",
                default_action=wafv2.CfnWebACL.DefaultActionProperty(allow={}),
                visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                    cloud_watch_metrics_enabled=True,
                    metric_name="ApiWebAcl",
                    sampled_requests_enabled=True,
                ),
                rules=[
                    wafv2.CfnWebACL.RuleProperty(
                        name="PerWorkspaceRate",
                        priority=10,
                        action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                        statement=wafv2.CfnWebACL.StatementProperty(
                            rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                                limit=per_ws_limit,
                                aggregate_key_type="CUSTOM_KEYS",
                                custom_keys=[
                                    wafv2.CfnWebACL.RateBasedStatementCustomKeyProperty(
                                        header=wafv2.CfnWebACL.RateLimitHeaderProperty(
                                            name="x-org-slug",
                                            text_transformations=[
                                                wafv2.CfnWebACL.TextTransformationProperty(
                                                    priority=0, type="LOWERCASE"
                                                )
                                            ],
                                        ),
                                    ),
                                ],
                            ),
                        ),
                        visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                            cloud_watch_metrics_enabled=True,
                            metric_name="PerWorkspaceRate",
                            sampled_requests_enabled=True,
                        ),
                    ),
                    wafv2.CfnWebACL.RuleProperty(
                        name="PerIpRate",
                        priority=20,
                        action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                        statement=wafv2.CfnWebACL.StatementProperty(
                            rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                                limit=per_ip_limit,
                                aggregate_key_type="IP",
                            ),
                        ),
                        visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                            cloud_watch_metrics_enabled=True,
                            metric_name="PerIpRate",
                            sampled_requests_enabled=True,
                        ),
                    ),
                    # Signup-specific tighter rate limit. scope_down_statement
                    # restricts the rate count to POSTs whose URI path ends
                    # in /signup — only those count against the budget.
                    wafv2.CfnWebACL.RuleProperty(
                        name="SignupPerIpRate",
                        priority=5,  # higher precedence than PerIpRate
                        action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                        statement=wafv2.CfnWebACL.StatementProperty(
                            rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                                limit=signup_limit,
                                aggregate_key_type="IP",
                                scope_down_statement=wafv2.CfnWebACL.StatementProperty(
                                    and_statement=wafv2.CfnWebACL.AndStatementProperty(
                                        statements=[
                                            wafv2.CfnWebACL.StatementProperty(
                                                byte_match_statement=wafv2.CfnWebACL.ByteMatchStatementProperty(
                                                    field_to_match=wafv2.CfnWebACL.FieldToMatchProperty(
                                                        uri_path={},
                                                    ),
                                                    positional_constraint="ENDS_WITH",
                                                    search_string="/signup",
                                                    text_transformations=[
                                                        wafv2.CfnWebACL.TextTransformationProperty(
                                                            priority=0, type="LOWERCASE"
                                                        )
                                                    ],
                                                ),
                                            ),
                                            wafv2.CfnWebACL.StatementProperty(
                                                byte_match_statement=wafv2.CfnWebACL.ByteMatchStatementProperty(
                                                    field_to_match=wafv2.CfnWebACL.FieldToMatchProperty(
                                                        method={},
                                                    ),
                                                    positional_constraint="EXACTLY",
                                                    search_string="POST",
                                                    text_transformations=[
                                                        wafv2.CfnWebACL.TextTransformationProperty(
                                                            priority=0, type="NONE"
                                                        )
                                                    ],
                                                ),
                                            ),
                                        ],
                                    ),
                                ),
                            ),
                        ),
                        visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                            cloud_watch_metrics_enabled=True,
                            metric_name="SignupPerIpRate",
                            sampled_requests_enabled=True,
                        ),
                    ),
                ],
            )

            wafv2.CfnWebACLAssociation(
                self,
                "ApiWebAclAssoc",
                web_acl_arn=web_acl.attr_arn,
                resource_arn=(
                    f"arn:aws:apigateway:{self.region}::/restapis/"
                    f"{api.rest_api_id}/stages/{config['api_stage']}"
                ),
            )

        # ─── CloudWatch alarms (ops visibility) ─────────────────────────────
        # All alarms use the same default-empty action list on staging
        # (they just appear in the console) and an SNS topic on prod
        # (configure via `config["ops_sns_topic_arn"]` when ready).
        # Keep the set small and load-bearing — each alarm is one more
        # thing to silence if it fires spuriously.
        self._add_cloudwatch_alarms(api=api, table=table, is_staging=is_staging)

        # ─── Outputs ─────────────────────────────────────────────────────────
        CfnOutput(self, "ApiUrl", value=api.url, description="API Gateway endpoint URL")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id, description="Cognito User Pool ID")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id, description="Cognito Client ID")
        CfnOutput(self, "TableName", value=table.table_name, description="DynamoDB Table Name")
        CfnOutput(self, "UploadsBucketName", value=uploads_bucket.bucket_name, description="S3 uploads bucket")
        CfnOutput(self, "CDNDomain", value=cdn.distribution_domain_name, description="CloudFront CDN domain")

    # ------------------------------------------------------------------
    # Ops
    # ------------------------------------------------------------------

    def _add_cloudwatch_alarms(
        self,
        *,
        api: apigw.RestApi,
        table: dynamodb.ITable,
        is_staging: bool,
    ) -> None:
        """Create the core set of ops alarms.

        Thresholds are deliberately conservative so they don't page on
        normal traffic bumps. Staging alarms are information-only (no
        SNS action); prod alarms can be wired to an ops topic by setting
        `config["ops_sns_topic_arn"]` and plumbing it through here.
        """

        # 1. API 5xx rate — gross metric for "something's broken."
        # Threshold: 5% of requests over 5 minutes, two consecutive
        # periods. A single spike isn't paged, sustained is.
        api_5xx = cloudwatch.MathExpression(
            expression="(m5xx / totalReq) * 100",
            using_metrics={
                "m5xx": api.metric_server_error(
                    period=Duration.minutes(5),
                    statistic="Sum",
                ),
                "totalReq": api.metric_count(
                    period=Duration.minutes(5),
                    statistic="Sum",
                ),
            },
            label="API 5xx %",
            period=Duration.minutes(5),
        )
        cloudwatch.Alarm(
            self,
            "Api5xxRateAlarm",
            metric=api_5xx,
            threshold=5,
            evaluation_periods=2,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description=(
                "API Gateway 5xx rate >5% over two 5-min windows. "
                "Usually means a Lambda is throwing uncaught exceptions."
            ),
        )

        # 2. API 4xx rate — high 4xx means auth breakage or bad client
        # deploys. More lenient threshold because some 4xx is normal.
        cloudwatch.Alarm(
            self,
            "Api4xxSpikeAlarm",
            metric=api.metric_client_error(
                period=Duration.minutes(5),
                statistic="Sum",
            ),
            threshold=100 if is_staging else 500,
            evaluation_periods=3,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description=(
                "API Gateway 4xx count spike. Check for an auth "
                "regression, a rate-limit storm, or a broken frontend deploy."
            ),
        )

        # 3. API p95 latency — anything above 3s is a bad UX regardless
        # of the cause (cold start, DDB throttle, external call timeout).
        cloudwatch.Alarm(
            self,
            "ApiLatencyP95Alarm",
            metric=api.metric_latency(
                period=Duration.minutes(5),
                statistic="p95",
            ),
            threshold=3000,  # milliseconds
            evaluation_periods=3,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description=(
                "API p95 latency >3s for 15 min. Could be cold starts, "
                "DDB throttle, or a slow downstream call."
            ),
        )

        # 4. DynamoDB user errors — mostly ConditionalCheckFailed on
        # idempotent writes, which is expected. A sudden spike suggests
        # a broken invariant (e.g. writing the wrong PK shape).
        cloudwatch.Alarm(
            self,
            "DdbUserErrorsAlarm",
            metric=table.metric_user_errors(
                period=Duration.minutes(5),
                statistic="Sum",
            ),
            threshold=50,
            evaluation_periods=2,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description=(
                "DynamoDB user errors >50 in 5 min. Often a broken "
                "ConditionExpression; check recent writes for bad PK shapes."
            ),
        )

        # 5. DynamoDB throttled requests — hitting per-partition limits.
        # Pay-per-request normally has no limit, but a hot PK can still
        # throttle. Non-zero is always worth investigating.
        cloudwatch.Alarm(
            self,
            "DdbThrottlesAlarm",
            metric=table.metric_throttled_requests_for_operations(
                operations=[
                    dynamodb.Operation.PUT_ITEM,
                    dynamodb.Operation.GET_ITEM,
                    dynamodb.Operation.UPDATE_ITEM,
                    dynamodb.Operation.DELETE_ITEM,
                    dynamodb.Operation.QUERY,
                    dynamodb.Operation.SCAN,
                ],
                period=Duration.minutes(5),
                statistic="Sum",
            ),
            threshold=10,
            evaluation_periods=2,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
            alarm_description=(
                "DynamoDB throttled requests >10 in 5 min. Usually a "
                "hot partition — look for an aggregate PK or a loop."
            ),
        )
