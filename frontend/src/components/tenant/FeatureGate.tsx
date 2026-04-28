'use client'

import { useTenant } from '@/lib/tenant/TenantProvider'

interface FeatureGateProps {
  /** Feature key on `OrgSettings.features`, e.g. `birthday_wishes`,
   * `screenshots`, `ai_summaries`. */
  feature: string
  /** What to render when the feature is enabled. */
  children: React.ReactNode
  /** What to render when the feature is disabled. Default: nothing. */
  fallback?: React.ReactNode
}

/** Returns true when the current tenant can use `feature` — i.e. their
 *  plan tier includes it AND the OWNER hasn't toggled it off in
 *  /settings/organization. Two independent gates:
 *
 *  - Plan: `current.plan.featuresAllowed` is the canonical list for
 *    the tenant's current PlanTier (FREE/PRO/ENTERPRISE). When the
 *    plan record is loaded and doesn't include the feature, we hide
 *    the affordance — the user would just hit a 403 if they tried.
 *  - Settings: `current.settings.features[feature]` is the OWNER-
 *    controlled toggle within an unlocked plan. Default = enabled.
 *
 *  Both fall back to "available" while data is in-flight to avoid a
 *  flash of upsell where the feature actually works. */
function isFeatureAvailable(
  current: ReturnType<typeof useTenant>['current'],
  feature: string,
): boolean {
  if (!current) return false
  // Plan gate: only enforced when the plan record is loaded AND lists
  // explicit features. A tenant on a stale schema (no plan row) keeps
  // working — same fail-open posture as the backend `require_feature`.
  const allowed = current.plan?.featuresAllowed
  if (Array.isArray(allowed) && allowed.length > 0) {
    if (!allowed.includes(feature)) return false
  }
  // Settings gate: missing key = enabled by default so adding a new
  // feature doesn't retroactively hide it for existing tenants.
  const features = current.settings?.features
  return features ? features[feature] !== false : true
}

/** Conditionally renders `children` when the current tenant can use
 *  the given feature (plan AND settings). Until /orgs/current has
 *  resolved we render the fallback — avoids flashing PRO content on
 *  a FREE tenant during the initial fetch. */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { current } = useTenant()
  if (!current) return <>{fallback}</>
  return <>{isFeatureAvailable(current, feature) ? children : fallback}</>
}

/** Imperative variant for logic branches that aren't JSX. */
export function useFeatureFlag(feature: string): boolean {
  const { current } = useTenant()
  return isFeatureAvailable(current, feature)
}
