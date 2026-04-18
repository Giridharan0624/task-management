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

/** Conditionally renders `children` when the current tenant has the
 * given feature enabled in OrgSettings. Until the tenant's settings
 * have loaded, the feature is treated as DISABLED (returns null) —
 * this avoids a flash of feature content for tenants that disabled it.
 *
 * Features that don't exist in the settings dict default to ENABLED so
 * that adding a new feature to the product doesn't retroactively hide
 * it for existing tenants that haven't opted in via settings. */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { current } = useTenant()
  const features = current?.settings?.features
  // During the initial load window (before /orgs/current returns) we
  // can't know the feature state. Render nothing rather than flashing
  // potentially-gated content.
  if (!current) return <>{fallback}</>
  // Missing key = enabled by default (new features aren't retroactive).
  const enabled = features ? features[feature] !== false : true
  return <>{enabled ? children : fallback}</>
}

/** Imperative variant for logic branches that aren't JSX. */
export function useFeatureFlag(feature: string): boolean {
  const { current } = useTenant()
  if (!current) return false
  const features = current.settings?.features
  return features ? features[feature] !== false : true
}
