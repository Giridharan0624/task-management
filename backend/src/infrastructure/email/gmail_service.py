import json
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from infrastructure.email.email_templates import (
    build_welcome_email_html,
    build_welcome_email_text,
)

logger = logging.getLogger(__name__)

# Cache credentials after first fetch
_cached_credentials: dict | None = None


def _get_gmail_credentials() -> tuple[str, str]:
    """Fetch Gmail credentials from Secrets Manager (or env vars as fallback)."""
    global _cached_credentials

    if _cached_credentials is not None:
        return _cached_credentials["user"], _cached_credentials["password"]

    secret_arn = os.environ.get("GMAIL_SECRET_ARN", "")
    if secret_arn:
        try:
            import boto3
            client = boto3.client("secretsmanager")
            resp = client.get_secret_value(SecretId=secret_arn)
            secret = json.loads(resp["SecretString"])
            _cached_credentials = secret
            return secret["user"], secret["password"]
        except Exception as e:
            logger.warning("Failed to fetch Gmail secret from Secrets Manager: %s", str(e))

    # Fallback to env vars (local development)
    user = os.environ.get("GMAIL_USER", "")
    password = os.environ.get("GMAIL_APP_PASSWORD", "")
    if user and password:
        _cached_credentials = {"user": user, "password": password}
    return user, password


class GmailEmailService:
    @staticmethod
    def send_welcome_email(
        recipient_email: str,
        recipient_name: str,
        employee_id: str,
        otp: str,
        app_url: str,
        role: str = "",
        department: str = "",
        company_name: str = "",
    ) -> None:
        gmail_user, gmail_password = _get_gmail_credentials()

        if not gmail_user or not gmail_password:
            logger.warning("Gmail credentials not configured — skipping welcome email")
            return

        html_body = build_welcome_email_html(
            name=recipient_name,
            employee_id=employee_id,
            email=recipient_email,
            otp=otp,
            app_url=app_url,
            role=role,
            department=department,
            company_name=company_name or "TaskFlow",
        )
        text_body = build_welcome_email_text(
            name=recipient_name,
            employee_id=employee_id,
            email=recipient_email,
            otp=otp,
            app_url=app_url,
            role=role,
            department=department,
            company_name=company_name or "TaskFlow",
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Welcome to TaskFlow — Your Login Credentials"
        msg["From"] = f"TaskFlow <{gmail_user}>"
        msg["To"] = recipient_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        try:
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(gmail_user, gmail_password)
                server.sendmail(gmail_user, recipient_email, msg.as_string())
            logger.info("Welcome email sent to %s", recipient_email)
        except Exception as e:
            logger.warning("Failed to send welcome email to %s: %s", recipient_email, str(e))
