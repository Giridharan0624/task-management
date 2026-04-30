from __future__ import annotations

from enum import Enum


class AuthMethod(str, Enum):
    API_KEY = "API_KEY"
    OAUTH2 = "OAUTH2"
    BASIC = "BASIC"
    WEBHOOK_ONLY = "WEBHOOK_ONLY"


class Capability(str, Enum):
    READ_ITEMS = "READ_ITEMS"
    WRITE_ITEMS = "WRITE_ITEMS"
    RECEIVE_WEBHOOKS = "RECEIVE_WEBHOOKS"
    OAUTH_CALLBACK = "OAUTH_CALLBACK"


class IntegrationStatus(str, Enum):
    CONNECTED = "CONNECTED"
    NEEDS_REAUTH = "NEEDS_REAUTH"
    PAUSED = "PAUSED"
    DISABLED = "DISABLED"
    ERROR = "ERROR"


class AssigneeMode(str, Enum):
    STRICT = "STRICT"
    FALLBACK = "FALLBACK"
    AUTO_INVITE = "AUTO_INVITE"


class ItemType(str, Enum):
    TASK = "TASK"


class ChangeType(str, Enum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    DELETED = "DELETED"
