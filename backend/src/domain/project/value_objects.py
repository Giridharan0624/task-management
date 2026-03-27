from enum import Enum


class ProjectRole(str, Enum):
    ADMIN = "ADMIN"
    TEAM_LEAD = "TEAM_LEAD"
    MEMBER = "MEMBER"
