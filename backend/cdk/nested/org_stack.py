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
