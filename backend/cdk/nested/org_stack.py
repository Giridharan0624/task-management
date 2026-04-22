"""Nested stack for the org bounded-context Lambdas + admin handlers.

Carved out of the parent stack to free CFN resource budget. The parent
was sitting at 499/500 with no headroom for new Lambdas; moving every
org-context handler here drops the parent by ~40 resources and gives
this nested stack its own 500-resource budget for future growth.

What's INSIDE this nested stack:
  - Public: signup, get-org-by-slug, accept-invite
  - Authed: get-current-org, update-settings, send/list/revoke-invite,
    roles_router, pipelines_router, list_audit_events
  - OWNER-only: transfer_ownership
  - Scheduled: retention_sweeper, seat_reconciliation

What's OUTSIDE (stays in parent):
  - DynamoDB Table — moving would replace it (catastrophic)
  - Cognito UserPool / Client — same reason
  - S3 bucket / CloudFront — same reason
  - API Gateway RestApi + Authorizer — methods are added here but the
    api.root construct is owned by the parent (cross-stack ref via
    CFN imports works automatically)
  - PreTokenTrigger Lambda — Cognito pool trigger references it; safer
    to keep it co-located with the pool
  - Layer (deps_layer) — passed in so functions share the same artifact

Cross-stack mechanics:
  CFN handles parent ↔ nested references via Outputs/ImportValue. CDK
  generates these automatically when you pass a parent-owned object
  (e.g. `table`, `api`) into a nested-stack constructor and reference
  it from inside. The synthesized templates show `Fn::ImportValue` /
  `Fn::GetAtt` between the two stacks; nothing manual to wire.

Cold-start blip: the first deploy after introducing this nested stack
moves Lambda functions between stacks. CFN executes that as DELETE
(parent) + CREATE (nested), so each function's first invocation after
deploy is a cold start. No data loss — Lambdas are stateless.
"""
from __future__ import annotations

from aws_cdk import (
    Duration,
    NestedStack,
    aws_apigateway as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_events as events,
    aws_events_targets as events_targets,
    aws_iam as iam,
    aws_lambda as _lambda,
    aws_logs as logs,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct


class OrgNestedStack(NestedStack):
    """Holds every org-context Lambda + the new admin handlers.

    Parent passes shared infrastructure in via the constructor — there's
    no global state and no implicit lookups, so the dependency graph is
    obvious from the kwargs.
    """

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
        gmail_secret: secretsmanager.ISecret,
        app_url: str,
        log_retention: logs.RetentionDays = logs.RetentionDays.THREE_MONTHS,
        hcaptcha_secret_value: str = "",
        uploads_bucket=None,
        # User-context resources that live under /users/* in the parent
        # tree but whose methods live here for CFN budget reasons.
        users_bulk_resource: apigw.IResource | None = None,
        users_me_email_resource: apigw.IResource | None = None,
        # Health + platform resources — same pattern, parent owns the
        # resource, the nested stack owns the Lambda + method.
        health_resource: apigw.IResource | None = None,
        platform_org_status_resource: apigw.IResource | None = None,
        platform_admin_user_ids: str = "",
        # Task-update resources — /task-updates and /task-updates/me.
        task_updates_resource: apigw.IResource | None = None,
        task_updates_me_resource: apigw.IResource | None = None,
        # /uploads/presign resource.
        uploads_presign_resource: apigw.IResource | None = None,
        cdn_domain: str = "",
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Shared lambda defaults ──────────────────────────────────────
        # Mirror the parent's `lambda_defaults` shape so handler config
        # stays identical no matter which stack the function lives in.
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
            *,
            cognito_policies: list[str] | None = None,
            authed: bool = True,
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
            method_kwargs: dict = {}
            if authed:
                method_kwargs["authorizer"] = authorizer
                method_kwargs["authorization_type"] = apigw.AuthorizationType.COGNITO
            else:
                method_kwargs["authorization_type"] = apigw.AuthorizationType.NONE
            resource.add_method(
                method,
                apigw.LambdaIntegration(fn),
                **method_kwargs,
            )
            return fn

        # ── Public signup ──────────────────────────────────────────────
        signup_resource = api.root.add_resource("signup")
        signup_fn = _lambda.Function(
            self,
            "SignupOrg",
            handler="contexts.org.handlers.signup_org.handler",
            **{**lambda_defaults, "timeout": Duration.seconds(15)},
        )
        table.grant_read_write_data(signup_fn)
        signup_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:AdminDeleteUser",  # rollback path
                ],
                resources=[user_pool.user_pool_arn],
            )
        )
        signup_resource.add_method(
            "POST",
            apigw.LambdaIntegration(signup_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )
        # Optional hCaptcha — only wired when the operator passes a
        # non-empty secret string. Local/staging can run without it;
        # prod flips it on by setting the value in the app entry point.
        if hcaptcha_secret_value:
            signup_fn.add_environment("HCAPTCHA_SECRET", hcaptcha_secret_value)

        # ── Public org lookup by slug (pre-login branding) ─────────────
        orgs = api.root.add_resource("orgs")
        orgs_by_slug = orgs.add_resource("by-slug").add_resource("{slug}")
        get_by_slug_fn = _lambda.Function(
            self,
            "GetOrgBySlug",
            handler="contexts.org.handlers.get_org_by_slug.handler",
            **lambda_defaults,
        )
        table.grant_read_data(get_by_slug_fn)
        orgs_by_slug.add_method(
            "GET",
            apigw.LambdaIntegration(get_by_slug_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # ── /orgs/current — full hydration on app load ─────────────────
        orgs_current = orgs.add_resource("current")
        add_api_lambda(
            "GetCurrentOrg",
            "contexts.org.handlers.get_current_org.handler",
            "GET",
            orgs_current,
        )

        # ── Settings (OWNER edits branding/terminology/features) ───────
        orgs_current_settings = orgs_current.add_resource("settings")
        add_api_lambda(
            "UpdateOrgSettings",
            "contexts.org.handlers.update_settings.handler",
            "PUT",
            orgs_current_settings,
        )

        # ── Invites ────────────────────────────────────────────────────
        orgs_current_invites = orgs_current.add_resource("invites")
        send_invite_fn = add_api_lambda(
            "SendInvite",
            "contexts.org.handlers.send_invite.handler",
            "POST",
            orgs_current_invites,
        )
        send_invite_fn.add_environment("GMAIL_SECRET_ARN", gmail_secret.secret_arn)
        send_invite_fn.add_environment("APP_URL", app_url)
        gmail_secret.grant_read(send_invite_fn)

        add_api_lambda(
            "ListInvites",
            "contexts.org.handlers.list_invites.handler",
            "GET",
            orgs_current_invites,
        )

        orgs_current_invite_by_token = orgs_current_invites.add_resource("{token}")
        add_api_lambda(
            "RevokeInvite",
            "contexts.org.handlers.revoke_invite.handler",
            "DELETE",
            orgs_current_invite_by_token,
        )

        # ── Public accept-invite (token IS the credential) ─────────────
        invites_root = api.root.add_resource("invites")
        invite_by_token = invites_root.add_resource("{token}")
        accept_invite_resource = invite_by_token.add_resource("accept")
        accept_invite_fn = _lambda.Function(
            self,
            "AcceptInvite",
            handler="contexts.org.handlers.accept_invite.handler",
            **{**lambda_defaults, "timeout": Duration.seconds(15)},
        )
        table.grant_read_write_data(accept_invite_fn)
        accept_invite_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:AdminDeleteUser",
                ],
                resources=[user_pool.user_pool_arn],
            )
        )
        accept_invite_resource.add_method(
            "POST",
            apigw.LambdaIntegration(accept_invite_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # ── Roles router (Phase 4) ────────────────────────────────────
        # Uses ANY method on /roles and /roles/{roleId} so one Lambda
        # serves all four CRUD verbs with minimal CFN resource cost.
        orgs_current_roles = orgs_current.add_resource("roles")
        roles_router_fn = add_api_lambda(
            "RolesRouter",
            "contexts.org.handlers.roles_router.handler",
            "ANY",
            orgs_current_roles,
        )
        orgs_current_role_by_id = orgs_current_roles.add_resource("{roleId}")
        orgs_current_role_by_id.add_method(
            "ANY", apigw.LambdaIntegration(roles_router_fn)
        )

        # ── Pipelines router (Phase 5) ────────────────────────────────
        # Same pattern as roles_router: one Lambda, two resources, ANY.
        orgs_current_pipelines = orgs_current.add_resource("pipelines")
        pipelines_router_fn = add_api_lambda(
            "PipelinesRouter",
            "contexts.org.handlers.pipelines_router.handler",
            "ANY",
            orgs_current_pipelines,
        )
        orgs_current_pipeline_by_id = orgs_current_pipelines.add_resource(
            "{pipelineId}"
        )
        orgs_current_pipeline_by_id.add_method(
            "ANY", apigw.LambdaIntegration(pipelines_router_fn)
        )

        # ── Audit log viewer ──────────────────────────────────────────
        orgs_current_audit = orgs_current.add_resource("audit")
        add_api_lambda(
            "ListAuditEvents",
            "contexts.org.handlers.list_audit_events.handler",
            "GET",
            orgs_current_audit,
        )

        # ── Ownership transfer ────────────────────────────────────────
        # Demands Cognito admin permissions because it promotes/demotes
        # users (sets `custom:systemRole` on each).
        orgs_current_transfer = orgs_current.add_resource("transfer-ownership")
        add_api_lambda(
            "TransferOwnership",
            "contexts.org.handlers.transfer_ownership.handler",
            "POST",
            orgs_current_transfer,
            cognito_policies=["cognito-idp:AdminUpdateUserAttributes"],
        )

        # ── Soft-delete lifecycle (owner-initiated) ──────────────────
        # delete → marks PENDING_DELETION, 30-day grace
        # undelete → clears within the grace window
        # export → JSON dump to S3 + presigned URL
        orgs_current_delete = orgs_current.add_resource("delete")
        add_api_lambda(
            "DeleteOrg",
            "contexts.org.handlers.delete_org.handler",
            "POST",
            orgs_current_delete,
        )
        orgs_current_undelete = orgs_current.add_resource("undelete")
        add_api_lambda(
            "UndeleteOrg",
            "contexts.org.handlers.undelete_org.handler",
            "POST",
            orgs_current_undelete,
        )
        orgs_current_export = orgs_current.add_resource("export")
        export_fn = _lambda.Function(
            self,
            "ExportOrg",
            handler="contexts.org.handlers.export_org.handler",
            # Small tenants take <30s; generous cap leaves headroom
            # for mid-sized. Enterprise needs an async pattern later.
            **{**lambda_defaults, "timeout": Duration.minutes(5)},
        )
        table.grant_read_data(export_fn)
        if uploads_bucket is not None:
            uploads_bucket.grant_put(export_fn)
            uploads_bucket.grant_read(export_fn)
            export_fn.add_environment(
                "UPLOADS_BUCKET", uploads_bucket.bucket_name,
            )
        orgs_current_export.add_method(
            "POST",
            apigw.LambdaIntegration(export_fn),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )

        # ── User-context cross-stack attachments ───────────────────
        # Methods on parent-owned resources; the method + its Lambda
        # live here for CFN budget reasons. The parent creates the
        # Resource nodes so api.root.resource_for_path still works in
        # other callers.
        if users_bulk_resource is not None:
            bulk_create_fn = _lambda.Function(
                self,
                "BulkCreateUsers",
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
            bulk_create_fn.add_environment(
                "GMAIL_SECRET_ARN", gmail_secret.secret_arn,
            )
            bulk_create_fn.add_environment("APP_URL", app_url)
            gmail_secret.grant_read(bulk_create_fn)
            users_bulk_resource.add_method(
                "POST",
                apigw.LambdaIntegration(bulk_create_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        if users_me_email_resource is not None:
            sync_email_fn = _lambda.Function(
                self,
                "SyncEmail",
                handler="contexts.user.handlers.sync_email.handler",
                **lambda_defaults,
            )
            table.grant_read_write_data(sync_email_fn)
            users_me_email_resource.add_method(
                "PUT",
                apigw.LambdaIntegration(sync_email_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        # Health check — unauthenticated DDB probe.
        if health_resource is not None:
            health_fn = _lambda.Function(
                self,
                "HealthCheck",
                handler="contexts.system.handlers.health.handler",
                **lambda_defaults,
            )
            table.grant_read_data(health_fn)
            health_resource.add_method(
                "GET",
                apigw.LambdaIntegration(health_fn),
                authorization_type=apigw.AuthorizationType.NONE,
            )

        # Task-update endpoints — attach methods to parent-owned
        # /task-updates and /task-updates/me resources.
        if task_updates_resource is not None and task_updates_me_resource is not None:
            submit_fn = _lambda.Function(
                self,
                "SubmitTaskUpdate",
                handler="contexts.taskupdate.handlers.submit_update.handler",
                **lambda_defaults,
            )
            table.grant_read_write_data(submit_fn)
            task_updates_resource.add_method(
                "POST",
                apigw.LambdaIntegration(submit_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

            list_updates_fn = _lambda.Function(
                self,
                "ListTaskUpdates",
                handler="contexts.taskupdate.handlers.list_updates.handler",
                **lambda_defaults,
            )
            table.grant_read_data(list_updates_fn)
            task_updates_resource.add_method(
                "GET",
                apigw.LambdaIntegration(list_updates_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

            my_update_fn = _lambda.Function(
                self,
                "MyTaskUpdate",
                handler="contexts.taskupdate.handlers.my_update.handler",
                **lambda_defaults,
            )
            table.grant_read_data(my_update_fn)
            task_updates_me_resource.add_method(
                "GET",
                apigw.LambdaIntegration(my_update_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        # S3 presign endpoint — scoped to uploads_bucket via CDK grants.
        if uploads_presign_resource is not None and uploads_bucket is not None:
            presign_fn = _lambda.Function(
                self,
                "GetPresignedUrl",
                handler="contexts.upload.handlers.presign.handler",
                **lambda_defaults,
            )
            table.grant_read_data(presign_fn)
            uploads_bucket.grant_put(presign_fn)
            presign_fn.add_environment(
                "UPLOADS_BUCKET", uploads_bucket.bucket_name,
            )
            presign_fn.add_environment("CDN_DOMAIN", cdn_domain)
            uploads_presign_resource.add_method(
                "GET",
                apigw.LambdaIntegration(presign_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        # Platform-operator suspension endpoint — env-allowlist gated.
        if platform_org_status_resource is not None:
            set_status_fn = _lambda.Function(
                self,
                "SetOrgStatus",
                handler="contexts.org.handlers.set_org_status.handler",
                **lambda_defaults,
            )
            table.grant_read_write_data(set_status_fn)
            set_status_fn.add_environment(
                "PLATFORM_ADMIN_USER_IDS", platform_admin_user_ids,
            )
            platform_org_status_resource.add_method(
                "POST",
                apigw.LambdaIntegration(set_status_fn),
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        # ── Scheduled: nightly hard-delete sweeper ────────────────────
        # Runs at 04:00 UTC (after retention + seat-reconciliation).
        # Physically removes every tenant-scoped row + Cognito users
        # for orgs past the 30-day grace period.
        hard_delete_fn = _lambda.Function(
            self,
            "HardDeleteSweeper",
            handler="contexts.org.handlers.hard_delete_sweeper.handler",
            **{**lambda_defaults, "timeout": Duration.minutes(15)},
        )
        table.grant_read_write_data(hard_delete_fn)
        hard_delete_fn.add_environment("USER_POOL_ID", user_pool.user_pool_id)
        hard_delete_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "cognito-idp:AdminDeleteUser",
                    "cognito-idp:ListUsers",
                ],
                resources=[user_pool.user_pool_arn],
            )
        )
        events.Rule(
            self,
            "HardDeleteSweeperSchedule",
            schedule=events.Schedule.cron(hour="4", minute="0"),
            targets=[events_targets.LambdaFunction(hard_delete_fn)],
        )

        # ── Scheduled: nightly retention sweeper ──────────────────────
        # Iterates every org, deletes activity heartbeats older than
        # plan.retention_days. ENTERPRISE (retention=None) is skipped.
        retention_fn = _lambda.Function(
            self,
            "RetentionSweeper",
            handler="contexts.activity.handlers.retention_sweeper.handler",
            **{**lambda_defaults, "timeout": Duration.minutes(5)},
        )
        table.grant_read_write_data(retention_fn)
        events.Rule(
            self,
            "RetentionSweeperSchedule",
            # 03:00 UTC daily — outside business hours for any tenant.
            schedule=events.Schedule.cron(hour="3", minute="0"),
            targets=[events_targets.LambdaFunction(retention_fn)],
        )

        # ── Scheduled: nightly seat reconciliation ────────────────────
        # Detects post-race seat overflow and audits via a synthetic
        # "system:reconciliation" actor. Read-only with respect to
        # users — never auto-removes anyone.
        seat_recon_fn = _lambda.Function(
            self,
            "SeatReconciliation",
            handler="contexts.org.handlers.seat_reconciliation.handler",
            **{**lambda_defaults, "timeout": Duration.minutes(5)},
        )
        table.grant_read_write_data(seat_recon_fn)
        events.Rule(
            self,
            "SeatReconciliationSchedule",
            schedule=events.Schedule.cron(hour="3", minute="30"),
            targets=[events_targets.LambdaFunction(seat_recon_fn)],
        )
