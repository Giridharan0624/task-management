import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.config import Config as BotoConfig

from contexts.org.infrastructure.dynamo_repository import OrgDynamoRepository
from shared_kernel.auth_context import extract_auth_context
from shared_kernel.errors import ValidationError
from shared_kernel.permissions import require_not_suspended
from shared_kernel.response import build_error, build_success

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
        require_not_suspended(auth)
        params = event.get("queryStringParameters") or {}

        upload_type = params.get("type", "")
        filename = params.get("filename", "")
        content_type = params.get("contentType", "application/octet-stream")

        # Validate upload type
        if upload_type not in UPLOAD_TYPES:
            raise ValidationError(f"Invalid type. Must be one of: {', '.join(UPLOAD_TYPES.keys())}")

        config = UPLOAD_TYPES[upload_type]

        # Plan-based feature gate. Reads the Plan record once per call —
        # cached in the Lambda warm container after the first hit. Refuses
        # the upload up front rather than letting it succeed and then
        # failing read-side at quota check.
        _enforce_plan_quota(auth.org_id, upload_type)

        # Validate content type
        if content_type not in config["allowed_types"]:
            raise ValidationError(f"File type '{content_type}' not allowed for {upload_type}")

        # Validate filename
        if not filename or len(filename) > 255:
            raise ValidationError("The file name is not valid. Please rename the file and try again.")

        # Extract extension
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()

        # Build S3 key with org_id prefix: orgs/{org_id}/{prefix}/{user_id}/{uuid}{ext}
        # The org_id prefix is critical for tenant isolation: if a user
        # forges a presigned URL with another tenant's user_id, they still
        # can't reach into another tenant's prefix because their JWT's
        # org_id determines the prefix.
        file_id = str(uuid.uuid4())
        key = f"orgs/{auth.org_id}/{config['prefix']}/{auth.user_id}/{file_id}{ext}"

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


# Maps an upload type to the `features_allowed` flag (on Plan) that gates
# it. None means "no plan gate; always allowed."
_TYPE_TO_FEATURE: dict[str, str | None] = {
    "avatar": None,
    "screenshot": "screenshots",   # PRO + ENTERPRISE only
    "attachment": "attachments",   # not currently in any plan tier — kept for future
}


def _enforce_plan_quota(org_id: str, upload_type: str) -> None:
    """Refuse the upload when the tenant's plan doesn't include the
    feature this upload type maps to. Best-effort — a failed Plan lookup
    falls open so a transient DDB hiccup never breaks an upload."""
    feature = _TYPE_TO_FEATURE.get(upload_type)
    if feature is None:
        return
    try:
        plan = OrgDynamoRepository().get_plan(org_id)
    except Exception:
        return
    if plan is None:
        return
    allowed = plan.features_allowed or set()
    if feature not in allowed:
        raise ValidationError(
            f"Your plan ({plan.tier.value}) does not include {feature}. "
            f"Upgrade to enable.",
        )
