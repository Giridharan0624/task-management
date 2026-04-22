'use client'

import { useQuery } from '@tanstack/react-query'
import { orgsApi } from '@/lib/api/orgsApi'
import type { Role } from '@/types/org'

const rolesKey = ['org', 'roles'] as const

/**
 * Fetch all role records for the current org. Filter client-side by
 * `scope` because the backend returns them unfiltered and the list
 * is small (typically <20 records per tenant).
 */
export function useRoles(filter: { scope?: Role['scope'] } = {}) {
  const query = useQuery({
    queryKey: rolesKey,
    queryFn: () => orgsApi.listRoles(),
    staleTime: 60_000,
  })
  const roles = query.data?.roles ?? []
  const scopedRoles = filter.scope
    ? roles.filter((r) => r.scope === filter.scope)
    : roles
  return {
    ...query,
    roles: scopedRoles,
    allPermissions: query.data?.allPermissions ?? [],
  }
}
