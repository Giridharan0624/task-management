'use client'

import { useCallback } from 'react'

import { useTenant } from '@/lib/tenant/TenantProvider'
import { translate } from '@/lib/tenant/i18n'

/** `useT()` hook — returns a `t(key)` function scoped to the current
 * tenant's terminology overrides.
 *
 * Usage:
 *   const t = useT()
 *   <h1>{t('task.plural')}</h1>     // "Tasks" or "Tickets" per-tenant
 *
 * Re-renders when the tenant's settings change (e.g. after an OWNER
 * edits terminology in the settings page). */
export function useT() {
  const { current } = useTenant()
  const terminology = current?.settings?.terminology ?? null
  return useCallback(
    (key: string) => translate(key, terminology),
    [terminology],
  )
}
