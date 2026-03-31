import json
import logging
import os

from shared.errors import AppError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": _ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
}


def build_success(status_code: int, data) -> dict:
    return {"statusCode": status_code, "headers": CORS_HEADERS, "body": json.dumps(data)}


def build_error(error: Exception) -> dict:
    if isinstance(error, AppError):
        return {
            "statusCode": error.status_code,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": error.message}),
        }
    logger.error("Unhandled error: %s", str(error), exc_info=True)
    return {
        "statusCode": 500,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": "Internal server error"}),
    }
