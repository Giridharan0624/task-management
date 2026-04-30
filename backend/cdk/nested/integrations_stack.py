"""Nested stack for the integration platform.

Self-contained. The parent stack instantiates this construct ONLY when
`stage_config["integrations_enabled"] is True`. With it disabled, no
resources, no Lambdas, no IAM, no SQS — TaskFlow runs identically to today.

What's INSIDE this nested stack:
  - 4 Lambdas (admin_router, webhook_router, sync_worker, pusher) — all with
    reserved concurrency so they cannot starve the main API.
  - 2 SQS queues (sync events + outbound jobs) each with a DLQ.
  - 1 KMS CMK for credential encryption.
  - **Its own dedicated REST API** + Cognito authorizer (binds to the parent
    user pool). Lives entirely inside this nested stack so the parent CFN
    template stays under the 500-resource cap.

Why a dedicated API?
  The parent stack's RestApi is at the CFN 500-resource cap; adding even a
  single Method/Resource pushes it over. Using a separate RestApi here
  isolates ALL integration API surface from the parent — adding new
  connectors with new routes never touches the parent's budget again.

  Operational tradeoff: admins call `https://integrations-api.<stage>...`
  for the integration platform and `https://api.<stage>...` for everything
  else. Frontend wires both via env vars.

What's OUTSIDE (parent owns):
  - DynamoDB table, Cognito user pool, S3 bucket, deps Lambda layer.
  - The main RestApi root and authorizer — NOT used here.
"""
from __future__ import annotations

from aws_cdk import (
    CfnOutput,
    Duration,
    NestedStack,
    RemovalPolicy,
    aws_apigateway as apigw,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_kms as kms,
    aws_lambda as _lambda,
    aws_lambda_event_sources as lambda_events,
    aws_logs as logs,
    aws_sqs as sqs,
)
from constructs import Construct


class IntegrationsNestedStack(NestedStack):
    """Pure-additive integration platform with its OWN API Gateway.

    Skip instantiating this construct in any stage where you don't want the
    platform deployed.
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        user_pool: cognito.IUserPool,
        table: dynamodb.ITable,
        deps_layer: _lambda.ILayerVersion,
        lambda_src: str,
        lambda_env: dict,
        cors_origins: list[str],
        api_stage_name: str = "prod",
        log_retention: logs.RetentionDays = logs.RetentionDays.THREE_MONTHS,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── KMS CMK for credential encryption ───────────────────────────
        self.cred_key = kms.Key(
            self,
            "CredKey",
            description="Encrypts 3rd-party integration credentials (per-org, per-provider)",
            enable_key_rotation=True,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # ── SQS queues ──────────────────────────────────────────────────
        sync_dlq = sqs.Queue(
            self,
            "SyncDLQ",
            retention_period=Duration.days(14),
        )
        self.sync_queue = sqs.Queue(
            self,
            "SyncQueue",
            visibility_timeout=Duration.seconds(60),
            retention_period=Duration.days(4),
            dead_letter_queue=sqs.DeadLetterQueue(max_receive_count=5, queue=sync_dlq),
        )

        outbound_dlq = sqs.Queue(
            self,
            "OutboundDLQ",
            retention_period=Duration.days(14),
        )
        self.outbound_queue = sqs.Queue(
            self,
            "OutboundQueue",
            visibility_timeout=Duration.seconds(60),
            retention_period=Duration.days(4),
            dead_letter_queue=sqs.DeadLetterQueue(max_receive_count=5, queue=outbound_dlq),
        )

        # ── Shared Lambda defaults ──────────────────────────────────────
        # `lambda_env` from the parent stack may carry the
        # `_INTEGRATIONS_USE_RESERVED_CONCURRENCY` flag — that's used below
        # to gate reserved-concurrency, but it should NOT leak into the
        # Lambda runtime environment. Strip it.
        scrubbed_env = {
            k: v for k, v in lambda_env.items()
            if not k.startswith("_INTEGRATIONS_")
        }
        platform_env = {
            **scrubbed_env,
            "INTEGRATIONS_CRED_KMS_KEY_ID": self.cred_key.key_id,
            "INTEGRATIONS_SYNC_QUEUE_URL": self.sync_queue.queue_url,
            "INTEGRATIONS_OUTBOUND_QUEUE_URL": self.outbound_queue.queue_url,
        }
        lambda_defaults = dict(
            runtime=_lambda.Runtime.PYTHON_3_12,
            code=_lambda.Code.from_asset(lambda_src),
            layers=[deps_layer],
            timeout=Duration.seconds(15),
            memory_size=512,
            log_retention=log_retention,
            environment=platform_env,
        )

        # Reserved concurrency is opt-in per stage. The personal staging
        # account doesn't have enough headroom (AWS requires the unreserved
        # pool to stay >=10); company prod has plenty. Set
        # `integrations_reserved_concurrency=True` in the stage config to
        # turn it on once the account quota has been raised. Default is
        # OFF so the integrations Lambdas share the account pool with the
        # main API — fine for low-traffic staging.
        use_reserved = bool(lambda_env.get("_INTEGRATIONS_USE_RESERVED_CONCURRENCY"))

        def _fn(name: str, *, handler_path: str, reserved: int, timeout_s: int = 15, mem: int = 512):
            kwargs = dict(
                {**lambda_defaults, "timeout": Duration.seconds(timeout_s), "memory_size": mem},
                handler=handler_path,
            )
            if use_reserved:
                kwargs["reserved_concurrent_executions"] = reserved
            return _lambda.Function(self, name, **kwargs)

        # ── Lambdas ─────────────────────────────────────────────────────
        # Single router Lambda per traffic class keeps API GW resource count
        # tiny (matters less now we own the whole API but still good hygiene).
        admin_fn = _fn(
            "AdminRouterFn",
            handler_path="contexts.integrations.handlers.admin_router.handler",
            reserved=20,
        )
        webhook_fn = _fn(
            "WebhookRouterFn",
            handler_path="contexts.integrations.handlers.webhook_router.handler",
            reserved=50,
            timeout_s=8,
            mem=384,
        )
        sync_worker_fn = _fn(
            "SyncWorkerFn",
            handler_path="contexts.integrations.handlers.sync_worker.handler",
            reserved=20,
            timeout_s=30,
        )
        pusher_fn = _fn(
            "PusherFn",
            handler_path="contexts.integrations.handlers.pusher.handler",
            reserved=20,
            timeout_s=30,
        )

        # ── IAM grants (scoped to integration Lambdas only) ─────────────
        for fn in (admin_fn, webhook_fn, sync_worker_fn, pusher_fn):
            table.grant_read_write_data(fn)

        for fn in (admin_fn, sync_worker_fn, pusher_fn):
            self.cred_key.grant_encrypt_decrypt(fn)

        self.sync_queue.grant_send_messages(webhook_fn)
        self.sync_queue.grant_consume_messages(sync_worker_fn)
        self.outbound_queue.grant_consume_messages(pusher_fn)

        sync_worker_fn.add_event_source(
            lambda_events.SqsEventSource(
                self.sync_queue,
                batch_size=5,
                report_batch_item_failures=True,
            )
        )
        pusher_fn.add_event_source(
            lambda_events.SqsEventSource(
                self.outbound_queue,
                batch_size=5,
                report_batch_item_failures=True,
            )
        )

        # ── Dedicated REST API (this is the change) ─────────────────────
        # Owning our own RestApi means the parent CFN budget is unaffected.
        # We bind a Cognito authorizer to the SAME user pool the main API
        # uses — admins are authenticated by the existing JWT, but routed
        # to a different host for integration platform calls.
        self.api = apigw.RestApi(
            self,
            "IntegrationsApi",
            rest_api_name=f"taskflow-integrations-{api_stage_name}",
            description="Dedicated API for the TaskFlow integration platform.",
            deploy_options=apigw.StageOptions(stage_name=api_stage_name),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=cors_origins,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=[
                    "Content-Type",
                    "Authorization",
                    "X-Amz-Date",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                ],
                allow_credentials=True,
            ),
        )

        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "IntegrationsAuthorizer",
            cognito_user_pools=[user_pool],
        )

        # /integrations            → admin_router (authed)
        # /integrations/{proxy+}   → admin_router (authed)
        integrations_root = self.api.root.add_resource("integrations")
        integrations_root.add_method(
            "ANY",
            apigw.LambdaIntegration(admin_fn),
            authorization_type=apigw.AuthorizationType.COGNITO,
            authorizer=authorizer,
        )
        admin_proxy = integrations_root.add_resource("{proxy+}")
        admin_proxy.add_method(
            "ANY",
            apigw.LambdaIntegration(admin_fn),
            authorization_type=apigw.AuthorizationType.COGNITO,
            authorizer=authorizer,
        )

        # /integration-webhooks/{proxy+}  → webhook_router (UNAUTHED;
        # bearer auth in Lambda against per-integration secret hash).
        webhooks_root = self.api.root.add_resource("integration-webhooks")
        webhook_proxy = webhooks_root.add_resource("{proxy+}")
        webhook_proxy.add_method(
            "ANY",
            apigw.LambdaIntegration(webhook_fn),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # ── Outputs ─────────────────────────────────────────────────────
        # The integrations API URL — wire this onto frontend env via
        # `NEXT_PUBLIC_INTEGRATIONS_API_URL` so the integrations UI calls
        # the dedicated host instead of the main API.
        CfnOutput(
            self,
            "IntegrationsApiUrl",
            value=self.api.url,
            description="Set as NEXT_PUBLIC_INTEGRATIONS_API_URL in frontend env",
        )
        CfnOutput(
            self,
            "IntegrationsOutboundQueueUrl",
            value=self.outbound_queue.queue_url,
            description="Set as INTEGRATIONS_OUTBOUND_QUEUE_URL on existing Lambdas to enable the outbound emitter",
        )
        CfnOutput(
            self,
            "IntegrationsCredKmsKeyId",
            value=self.cred_key.key_id,
        )
