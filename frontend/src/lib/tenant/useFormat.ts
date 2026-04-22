'use client'

import { useMemo } from 'react'
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelative,
  formatTime,
} from '@/lib/utils/format'
import { useLocale } from './useLocale'

/**
 * Locale-aware formatters bound to the current tenant's settings.
 *
 * Drop-in replacement for hand-rolled `Date.toLocaleString()` calls
 * and raw `toFixed(2)` — the whole app renders with the tenant's
 * configured locale / timezone / currency without call-site
 * branching.
 *
 * Usage:
 *   const fmt = useFormat()
 *   <p>{fmt.date(task.createdAt)}</p>
 *   <p>{fmt.currency(project.estimatedBudget)}</p>
 *   <p>{fmt.relative(message.createdAt)}</p>
 */
export function useFormat() {
  const { locale, timezone, currency } = useLocale()

  return useMemo(
    () => ({
      date: (value: string | number | Date, opts?: Intl.DateTimeFormatOptions) =>
        formatDate(value, locale, timezone, opts),
      time: (value: string | number | Date, opts?: Intl.DateTimeFormatOptions) =>
        formatTime(value, locale, timezone, opts),
      number: (value: number, opts?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, opts),
      currency: (value: number, opts?: Intl.NumberFormatOptions) =>
        formatCurrency(value, locale, currency, opts),
      relative: (value: string | number | Date) => formatRelative(value, locale),
      locale,
      timezone,
      currencyCode: currency,
    }),
    [locale, timezone, currency],
  )
}
