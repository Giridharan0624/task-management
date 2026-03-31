from enum import Enum


class TaskStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DEVELOPED = "DEVELOPED"
    TESTING = "TESTING"
    TESTED = "TESTED"
    DEBUGGING = "DEBUGGING"
    FINAL_TESTING = "FINAL_TESTING"
    DONE = "DONE"


# Progress score per status (used for weighted progress calculations)
STATUS_PROGRESS = {
    "TODO": 0,
    "IN_PROGRESS": 15,
    "DEVELOPED": 35,
    "TESTING": 50,
    "TESTED": 65,
    "DEBUGGING": 50,
    "FINAL_TESTING": 80,
    "DONE": 100,
}


class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
