class AppError(Exception):
    """Base for typed application errors.

    The optional `code` is a stable string the frontend can branch on
    (e.g. "ORG_SUSPENDED") without matching human-readable messages. When
    set, `build_error` includes it in the response body as `error_code`.
    """

    def __init__(self, message: str, status_code: int = 500, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class ValidationError(AppError):
    def __init__(self, message: str, code: str | None = None):
        super().__init__(message, 400, code)


class AuthorizationError(AppError):
    def __init__(self, message: str = "Forbidden", code: str | None = None):
        super().__init__(message, 403, code)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found", code: str | None = None):
        super().__init__(message, 404, code)


class OrgSuspendedError(AuthorizationError):
    """Raised by `require_not_suspended` — frontend renders a dedicated
    'workspace suspended' screen when it sees this code."""

    def __init__(self, message: str = "This workspace is currently suspended."):
        super().__init__(message, code="ORG_SUSPENDED")


class EmailNotVerifiedError(AuthorizationError):
    """Raised by `require_email_verified` — frontend routes the user to
    /verify-email when it sees this code. The primary gate is a
    frontend redirect post-login; this exists for defense-in-depth on
    backend handlers that want to be paranoid (invites, role changes,
    billing ops)."""

    def __init__(
        self,
        message: str = "Please verify your email before continuing.",
    ):
        super().__init__(message, code="EMAIL_NOT_VERIFIED")


class OrgPendingDeletionError(AuthorizationError):
    """Raised when the caller's tenant is scheduled for deletion. Every
    mutation handler blocks via `require_not_suspended` (which now
    covers both SUSPENDED and PENDING_DELETION) so the user has a
    read-only view with a visible "recover workspace" affordance
    during the 30-day grace period."""

    def __init__(
        self,
        message: str = (
            "This workspace is scheduled for deletion. Recover it within "
            "the 30-day grace period to restore access."
        ),
    ):
        super().__init__(message, code="ORG_PENDING_DELETION")
