"""Declarative connect-form schema for the Freshworks (Freshdesk) connector.

The platform reads this schema from the connector at /integrations/providers
and the frontend's DynamicConnectForm renders it as fields. Adding/removing
fields here updates the UI without any frontend code change.
"""
from __future__ import annotations


CONNECT_FORM_SCHEMA: dict = {
    "title": "Connect Freshdesk",
    "description": (
        "Enter your Freshdesk subdomain and an API key. The API key authenticates "
        "every call from TaskFlow to Freshdesk; we never see your password."
    ),
    "fields": [
        {
            "name": "subdomain",
            "label": "Subdomain",
            "type": "text",
            "placeholder": "acme",
            "help": "If your Freshdesk URL is acme.freshdesk.com, enter `acme`.",
            "required": True,
            "pattern": r"^[a-z0-9][a-z0-9-]{1,62}$",
        },
        {
            "name": "api_key",
            "label": "API key",
            "type": "password",
            "placeholder": "Generate from Profile → API Key in Freshdesk",
            "help": (
                "Sign in to Freshdesk, click your avatar → Profile, then copy the "
                "API key shown at the bottom right."
            ),
            "required": True,
            "secret": True,
        },
        {
            "name": "product",
            "label": "Product",
            "type": "select",
            "required": True,
            "default": "freshdesk",
            "options": [
                {"value": "freshdesk", "label": "Freshdesk"},
                {"value": "freshservice", "label": "Freshservice"},
            ],
        },
    ],
    "post_connect_steps": [
        {
            "title": "Configure Workflow Automator in Freshdesk",
            "body": (
                "After connecting, paste the webhook URL we generate into a new "
                "Workflow Automator rule (Admin → Workflows → Workflow Automator → "
                "New Rule → Action: Trigger Webhook). Use the Authorization header "
                "value we provide."
            ),
        },
    ],
}
