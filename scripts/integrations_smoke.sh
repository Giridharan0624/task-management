#!/usr/bin/env bash
# Staging smoke-test for the integration platform.
#
# Run AFTER `cdk deploy --app "python app_staging.py"` succeeds and you
# have the IntegrationsApiUrl from the CFN output.
#
# Verifies, in order:
#   1. The integrations API is reachable.
#   2. /integrations/providers requires auth (401 without JWT).
#   3. With a valid JWT, /integrations/providers returns the Freshdesk connector.
#   4. The webhook endpoint is reachable AND rejects requests without a bearer.
#
# Usage:
#   export INTEGRATIONS_API_URL="https://abc123.execute-api.ap-south-1.amazonaws.com/staging"
#   export TASKFLOW_JWT="<paste a Cognito ID token from the staging frontend>"
#   ./scripts/integrations_smoke.sh
#
# A passing run prints "ALL CHECKS PASSED" and exits 0. Any failure aborts
# with a non-zero exit code and a description of what went wrong.

set -euo pipefail

INTEGRATIONS_API_URL="${INTEGRATIONS_API_URL:-}"
TASKFLOW_JWT="${TASKFLOW_JWT:-}"

if [[ -z "$INTEGRATIONS_API_URL" ]]; then
  echo "ERROR: INTEGRATIONS_API_URL is required" >&2
  echo "  Get it from the CFN output IntegrationsApiUrl after cdk deploy." >&2
  exit 1
fi

# Strip trailing slash to make path concatenation predictable.
BASE="${INTEGRATIONS_API_URL%/}"

echo "▶ Smoke-testing $BASE"
echo

# ── 1. Unauthed request to /integrations/providers must be 401 ────────
echo "1/4 GET /integrations/providers with NO auth → expect 401"
status_unauthed=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/integrations/providers")
if [[ "$status_unauthed" != "401" ]]; then
  echo "  ✘ FAIL — expected 401, got $status_unauthed"
  exit 2
fi
echo "  ✔ 401 as expected"
echo

# ── 2. Unauthed POST to a webhook path must be 401 (bad bearer guard) ─
echo "2/4 POST /integration-webhooks/freshdesk/webhook/x/y with NO bearer → expect 401"
status_webhook=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -H "Content-Type: application/json" -d '{}' \
  "$BASE/integration-webhooks/freshdesk/webhook/test-org/test-int")
# 401 from the Lambda OR 404 from API GW are both acceptable rejections.
# Anything 2xx is broken.
if [[ "$status_webhook" =~ ^2 ]]; then
  echo "  ✘ FAIL — webhook accepted an unauthenticated request (got $status_webhook)"
  exit 3
fi
echo "  ✔ rejected (status $status_webhook)"
echo

# ── 3. Authed request to /integrations/providers returns Freshdesk ────
if [[ -z "$TASKFLOW_JWT" ]]; then
  echo "3/4 SKIPPED — set TASKFLOW_JWT to verify connector registration"
  echo "       (paste an ID token from the staging frontend after login)"
else
  echo "3/4 GET /integrations/providers with JWT → expect 200 + Freshdesk listed"
  body=$(curl -s -H "Authorization: Bearer $TASKFLOW_JWT" "$BASE/integrations/providers")
  if ! echo "$body" | grep -q '"freshdesk"'; then
    echo "  ✘ FAIL — Freshdesk connector not found in response:"
    echo "$body" | head -c 500
    exit 4
  fi
  echo "  ✔ Freshdesk connector registered"
fi
echo

# ── 4. Authed list of integrations returns 200 (likely empty) ─────────
if [[ -z "$TASKFLOW_JWT" ]]; then
  echo "4/4 SKIPPED — needs TASKFLOW_JWT"
else
  echo "4/4 GET /integrations with JWT → expect 200"
  status_list=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TASKFLOW_JWT" "$BASE/integrations")
  if [[ "$status_list" != "200" ]]; then
    echo "  ✘ FAIL — expected 200, got $status_list"
    exit 5
  fi
  echo "  ✔ 200 OK"
fi
echo

echo "ALL CHECKS PASSED"
