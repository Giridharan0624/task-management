'use client'

import { useQuery } from '@tanstack/react-query'

import { orgsApi } from '@/lib/api/orgsApi'
import type { OrgPlan } from '@/types/org'

/**
 * Read-only access to the current org's plan. Cached for 60s — plan
 * upgrades are rare, and stale-while-revalidate keeps the UI responsive.
 *
 * Used by feature gates that need to check `plan.tier` (e.g. integrations
 * settings, AI features, screenshots).
 */
export function useOrgPlan() {
  const query = useQuery({
    queryKey: ['org', 'current'],
    queryFn: () => orgsApi.getCurrent(),
    staleTime: 60_000,
  })
  const plan: OrgPlan | null = query.data?.plan ?? null
  return { ...query, plan, tier: plan?.tier ?? null }
}

export function isIntegrationsAllowed(tier: string | null | undefined): boolean {
  return tier === 'PRO' || tier === 'ENTERPRISE'
}
