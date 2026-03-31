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

GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")


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
        if not GMAIL_USER or not GMAIL_APP_PASSWORD:
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
        msg["From"] = f"TaskFlow <{GMAIL_USER}>"
        msg["To"] = recipient_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        try:
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                server.sendmail(GMAIL_USER, recipient_email, msg.as_string())
            logger.info("Welcome email sent to %s", recipient_email)
        except Exception as e:
            logger.warning("Failed to send welcome email to %s: %s", recipient_email, str(e))
