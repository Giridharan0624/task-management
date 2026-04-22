import { apiClient } from './client'

/**
 * Platform-operator actions — the subject is ALWAYS a different
 * tenant than the caller's own org. All three require the caller's
 * Cognito sub to be in the backend's PLATFORM_ADMIN_USER_IDS env
 * allowlist (fail-closed when unset).
 */

export function suspendOrg(orgId: string, reason?: string): Promise<{
  org: { status: string }
  noOp?: boolean
}> {
  return apiClient.post(`/platform/orgs/${encodeURIComponent(orgId)}/status`, {
    status: 'SUSPENDED',
    reason: reason ?? '',
  })
}

export function unsuspendOrg(orgId: string, reason?: string): Promise<{
  org: { status: string }
  noOp?: boolean
}> {
  return apiClient.post(`/platform/orgs/${encodeURIComponent(orgId)}/status`, {
    status: 'ACTIVE',
    reason: reason ?? '',
  })
}

export function setOrgFeatures(
  orgId: string,
  features: Record<string, boolean>,
): Promise<{ orgId: string; features: Record<string, boolean> }> {
  return apiClient.patch(
    `/platform/orgs/${encodeURIComponent(orgId)}/features`,
    { features },
  )
}
