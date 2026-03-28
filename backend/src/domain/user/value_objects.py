from enum import Enum


class SystemRole(str, Enum):
    OWNER = "OWNER"
    CEO = "CEO"
    MD = "MD"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
