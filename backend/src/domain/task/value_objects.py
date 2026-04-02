from enum import Enum


class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class TaskDomain(str, Enum):
    DEVELOPMENT = "DEVELOPMENT"
    DESIGNING = "DESIGNING"
    MANAGEMENT = "MANAGEMENT"
    RESEARCH = "RESEARCH"


# Domain-specific pipeline steps (ordered)
DOMAIN_STATUSES: dict[str, list[str]] = {
    "DEVELOPMENT": ["TODO", "IN_PROGRESS", "DEVELOPED", "CODE_REVIEW", "TESTING", "DEBUGGING", "FINAL_TESTING", "DONE"],
    "DESIGNING": ["TODO", "IN_PROGRESS", "WIREFRAME", "DESIGN", "REVIEW", "REVISION", "APPROVED", "DONE"],
    "MANAGEMENT": ["TODO", "PLANNING", "IN_PROGRESS", "EXECUTION", "REVIEW", "DONE"],
    "RESEARCH": ["TODO", "IN_PROGRESS", "RESEARCH", "ANALYSIS", "DOCUMENTATION", "REVIEW", "DONE"],
}

# All possible statuses across all domains (for the enum)
ALL_STATUSES = sorted(set(s for statuses in DOMAIN_STATUSES.values() for s in statuses))

# Progress scores per domain (auto-calculated: evenly distributed 0-100)
DOMAIN_PROGRESS: dict[str, dict[str, int]] = {}
for domain, statuses in DOMAIN_STATUSES.items():
    n = len(statuses)
    DOMAIN_PROGRESS[domain] = {s: round((i / (n - 1)) * 100) if n > 1 else 0 for i, s in enumerate(statuses)}

# Flat progress map (fallback for legacy tasks without domain)
STATUS_PROGRESS: dict[str, int] = {}
for domain_scores in DOMAIN_PROGRESS.values():
    for status, score in domain_scores.items():
        if status not in STATUS_PROGRESS:
            STATUS_PROGRESS[status] = score

# Human-readable labels
STATUS_LABELS: dict[str, str] = {
    "TODO": "To Do", "IN_PROGRESS": "In Progress",
    "DEVELOPED": "Developed", "CODE_REVIEW": "Code Review",
    "TESTING": "Testing", "DEBUGGING": "Debugging", "FINAL_TESTING": "Final Testing",
    "WIREFRAME": "Wireframe", "DESIGN": "Design", "REVIEW": "Review",
    "REVISION": "Revision", "APPROVED": "Approved",
    "PLANNING": "Planning", "EXECUTION": "Execution",
    "RESEARCH": "Research", "ANALYSIS": "Analysis", "DOCUMENTATION": "Documentation",
    "TESTED": "Tested",
    "DONE": "Done",
}
