from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class Credentials(BaseModel):
    """Opaque credential blob handed to a connector.

    The platform never inspects the contents of `secret_payload`; it is
    encrypted with a KMS data key on write and decrypted only when a connector
    needs it. Connectors define their own JSON shape — for Freshworks it holds
    {subdomain, api_key}; for OAuth providers it would hold {access_token,
    refresh_token, expires_at}.
    """

    secret_payload: dict[str, Any]
    public_metadata: dict[str, Any] = {}


class AccountInfo(BaseModel):
    """What a connector returns from verify_credentials. Used to render a
    human-readable label on the integration record (e.g. 'Freshdesk: acme')."""

    account_id: str
    display_name: str
    extra: dict[str, Any] = {}
