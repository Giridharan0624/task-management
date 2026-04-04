import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.config import Config as BotoConfig

from handlers.shared.auth_context import extract_auth_context
from handlers.shared.response import build_error, build_success
from shared.errors import ValidationError

BUCKET = os.environ.get("UPLOADS_BUCKET", "")
CDN_DOMAIN = os.environ.get("CDN_DOMAIN", "")
REGION = os.environ.get("AWS_REGION", "ap-south-1")
s3_client = boto3.client(
    "s3",
    region_name=REGION,
    config=BotoConfig(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"},
    ),
)

# Allowed upload types and their constraints
UPLOAD_TYPES = {
    "avatar": {
        "prefix": "avatars",
        "max_size": 5 * 1024 * 1024,       # 5 MB
        "allowed_types": ["image/jpeg", "image/png", "image/webp"],
    },
    "screenshot": {
        "prefix": "screenshots",
        "max_size": 2 * 1024 * 1024,        # 2 MB (compressed JPEG)
        "allowed_types": ["image/jpeg"],
    },
    "attachment": {
        "prefix": "attachments",
        "max_size": 25 * 1024 * 1024,       # 25 MB
        "allowed_types": [
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain", "text/csv",
        ],
    },
}


def handler(event, context):
    """
    GET /uploads/presign?type=avatar&filename=photo.jpg&contentType=image/jpeg

    Returns:
        {
            "uploadUrl": "https://s3...presigned-put-url",
            "fileUrl": "https://cdn-domain/avatars/user-id/uuid.jpg",
            "key": "avatars/user-id/uuid.jpg"
        }
    """
    try:
        auth = extract_auth_context(event)
        params = event.get("queryStringParameters") or {}

        upload_type = params.get("type", "")
        filename = params.get("filename", "")
        content_type = params.get("contentType", "application/octet-stream")

        # Validate upload type
        if upload_type not in UPLOAD_TYPES:
            raise ValidationError(f"Invalid type. Must be one of: {', '.join(UPLOAD_TYPES.keys())}")

        config = UPLOAD_TYPES[upload_type]

        # Validate content type
        if content_type not in config["allowed_types"]:
            raise ValidationError(f"File type '{content_type}' not allowed for {upload_type}")

        # Validate filename
        if not filename or len(filename) > 255:
            raise ValidationError("Invalid filename")

        # Extract extension
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()

        # Build S3 key: {prefix}/{user_id}/{uuid}{ext}
        file_id = str(uuid.uuid4())
        key = f"{config['prefix']}/{auth.user_id}/{file_id}{ext}"

        # Generate presigned PUT URL (expires in 10 minutes)
        upload_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=600,  # 10 minutes
        )

        # File URL via CloudFront CDN
        file_url = f"https://{CDN_DOMAIN}/{key}"

        return build_success(200, {
            "upload_url": upload_url,
            "file_url": file_url,
            "key": key,
        })

    except Exception as e:
        return build_error(e)
