from __future__ import annotations

import json
import os
from typing import Any

import boto3

from contexts.integrations.domain.credentials import Credentials


_kms = boto3.client("kms", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def _key_id() -> str:
    key_id = os.environ.get("INTEGRATIONS_CRED_KMS_KEY_ID")
    if not key_id:
        raise RuntimeError("INTEGRATIONS_CRED_KMS_KEY_ID env var not set")
    return key_id


def encrypt(creds: Credentials, encryption_context: dict[str, str]) -> bytes:
    """Encrypt a credentials blob under the platform CMK. The encryption
    context binds the ciphertext to (org_id, integration_id, provider) so a
    leaked blob cannot be decrypted in a different scope."""
    plaintext = json.dumps(
        {
            "secret_payload": creds.secret_payload,
            "public_metadata": creds.public_metadata,
        }
    ).encode("utf-8")
    response = _kms.encrypt(
        KeyId=_key_id(),
        Plaintext=plaintext,
        EncryptionContext=encryption_context,
    )
    return response["CiphertextBlob"]


def decrypt(ciphertext: bytes, encryption_context: dict[str, str]) -> Credentials:
    response = _kms.decrypt(
        CiphertextBlob=ciphertext,
        EncryptionContext=encryption_context,
    )
    payload: dict[str, Any] = json.loads(response["Plaintext"].decode("utf-8"))
    return Credentials(
        secret_payload=payload.get("secret_payload", {}),
        public_metadata=payload.get("public_metadata", {}),
    )


def encryption_context(org_id: str, integration_id: str, provider: str) -> dict[str, str]:
    return {
        "org_id": org_id,
        "integration_id": integration_id,
        "provider": provider,
    }
