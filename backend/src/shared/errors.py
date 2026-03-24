class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, 400)


class AuthorizationError(AppError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, 403)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(message, 404)
