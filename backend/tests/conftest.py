import os
import sys
from pathlib import Path

# Ensure the src directory is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

# Set env vars BEFORE any test module imports a repository — the
# dynamo_client module caches the boto3 resource and table name at
# import time, so a fixture that sets them later has no effect.
# These values are deliberately fake; tests that need real DDB spin up
# a moto-backed endpoint and re-point dynamo_client.
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_SESSION_TOKEN", "testing")
os.environ.setdefault("TABLE_NAME", "TaskManagementTable-test")
