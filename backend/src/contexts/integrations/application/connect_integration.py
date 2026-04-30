from __future__ import annotations

import hashlib
import secrets
import uuid
from typing import Optional

from contexts.integrations.domain.connector_protocol import Connector
from contexts.integrations.domain.credentials import Credentials
from contexts.integrations.domain.entities import Integration
from contexts.integrations.domain.repository import IIntegrationRepository
from contexts.integrations.domain.value_objects import AssigneeMode
from contexts.integrations.infrastructure import kms_credentials
from shared_kernel.errors import ValidationError


def connect_integration(
    *,
    org_id: str,
    user_id: str,
    connector: Connector,
    raw_form_payload: dict,
    repo: IIntegrationRepository,
    plan_check: Optional[callable] = None,
    assignee_mode: AssigneeMode = AssigneeMode.STRICT,
    fallback_assignee_id: Optional[str] = None,
    linked_project_id: Optional[str] = None,
) -> tuple[Integration, str]:
    """Validate credentials with the connector, create the Integration record,
    encrypt the credential blob with KMS, generate a webhook secret, and
    persist. Returns (integration, webhook_secret_plaintext) — the plaintext
    secret is shown ONCE in the response so the admin can paste it into the
    provider's webhook config; only the SHA-256 hash is stored.

    `plan_check` is a callable(org_id) that raises if the plan does not allow
    another integration. Provided by the handler so this use case stays free
    of org-context imports.
    """
    if plan_check is not None:
        plan_check(org_id)

    creds_payload = _build_credential_payload(connector, raw_form_payload)
    creds = Credentials(secret_payload=creds_payload, public_metadata={})

    try:
        account_info = connector.verify_credentials(creds)
    except Exception as exc:
        raise ValidationError(
            f"Could not verify credentials with {connector.display_name}: {exc}",
            code="INTEGRATION_VERIFY_FAILED",
        ) from exc

    integration_id = uuid.uuid4().hex
    webhook_secret_plain = secrets.token_urlsafe(32)
    webhook_secret_hash = hashlib.sha256(webhook_secret_plain.encode("utf-8")).hexdigest()

    encryption_context = kms_credentials.encryption_context(
        org_id=org_id, integration_id=integration_id, provider=connector.provider
    )
    encrypted = kms_credentials.encrypt(creds, encryption_context)

    integration = Integration.create(
        integration_id=integration_id,
        org_id=org_id,
        provider=connector.provider,
        display_name=f"{connector.display_name}: {account_info.display_name}",
        account_id=account_info.account_id,
        encrypted_credentials=encrypted,
        webhook_secret_hash=webhook_secret_hash,
        connected_by=user_id,
        assignee_mode=assignee_mode,
        fallback_assignee_id=fallback_assignee_id,
        linked_project_id=linked_project_id,
    )
    repo.save(integration)
    return integration, webhook_secret_plain


def _build_credential_payload(connector: Connector, raw_form_payload: dict) -> dict:
    """Pull out only the fields declared in the connector's connect_form_schema.
    Anything else in the payload is silently dropped (defense in depth)."""
    schema = connector.connect_form_schema or {}
    fields = schema.get("fields", [])
    out: dict = {}
    missing: list[str] = []
    for field in fields:
        name = field.get("name")
        if name is None:
            continue
        if name in raw_form_payload:
            out[name] = raw_form_payload[name]
        elif field.get("required", False):
            missing.append(name)
    if missing:
        raise ValidationError(
            f"Missing required fields: {', '.join(missing)}",
            code="INTEGRATION_FORM_INCOMPLETE",
        )
    return out
