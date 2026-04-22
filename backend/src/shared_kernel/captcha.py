"""hCaptcha verification — server-side token check for the signup flow.

Called from `signup_org.handler` before any Cognito / DynamoDB work.
If the secret is missing or empty, verification is SKIPPED — lets
local dev and staging iterate without setting up a captcha siteverify
round-trip. Prod sets `HCAPTCHA_SECRET` and the Lambda env var.

hCaptcha chosen over reCAPTCHA: free at any volume, no Google account
required, GDPR-friendly, drop-in API compat.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request

from shared_kernel.errors import ValidationError

log = logging.getLogger("taskflow.captcha")

HCAPTCHA_ENDPOINT = "https://api.hcaptcha.com/siteverify"
_TIMEOUT_SECONDS = 4


def verify_captcha(token: str | None) -> None:
    """Raise ValidationError if the captcha token is invalid or missing.

    Skips entirely when `HCAPTCHA_SECRET` is unset/empty — lets dev and
    test environments bypass. A misconfigured prod deploy (secret
    missing in env) would silently lose the captcha guard; the CDK app
    layer is responsible for wiring the env var, and a deploy-time
    check in the ops runbook catches a forgotten set.
    """
    secret = os.environ.get("HCAPTCHA_SECRET", "").strip()
    if not secret:
        return  # bypass — see docstring

    if not token:
        raise ValidationError(
            "Captcha token is required.",
            code="CAPTCHA_MISSING",
        )

    data = urllib.parse.urlencode({
        "secret": secret,
        "response": token,
    }).encode("utf-8")
    req = urllib.request.Request(
        HCAPTCHA_ENDPOINT,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT_SECONDS) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        # Fail closed on network hiccups — a dropped siteverify call
        # should not let signup bypass the gate in prod. Log loudly so
        # ops can tell it apart from an attacker attempt.
        log.warning("hcaptcha-siteverify-failed: %s", e)
        raise ValidationError(
            "Captcha verification temporarily unavailable. Please retry.",
            code="CAPTCHA_UNAVAILABLE",
        )

    if not payload.get("success"):
        error_codes = payload.get("error-codes", [])
        log.info("hcaptcha-rejected: %s", error_codes)
        raise ValidationError(
            "Captcha failed. Please retry.",
            code="CAPTCHA_REJECTED",
        )
