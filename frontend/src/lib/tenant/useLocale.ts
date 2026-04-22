'use client'

import { useTenant } from './TenantProvider'

/**
 * Resolve locale-related display settings from the current tenant.
 *
 * Each field falls back to a sensible default so callers don't have
 * to handle the unauthenticated / pre-hydration state manually:
 *
 *   locale       BCP-47 language tag, e.g. 'en-IN', 'en-US'. Defaults
 *                to the browser's resolvedOptions().locale so pre-tenant
 *                rendering still matches the user's expectations.
 *   timezone     IANA tz name, e.g. 'Asia/Kolkata'. Defaults to the
 *                browser's resolvedOptions().timeZone.
 *   currency     ISO-4217 code, e.g. 'INR', 'USD'. Defaults to 'USD'.
 *   weekStartDay 0=Sunday .. 6=Saturday. Defaults to 1 (Monday).
 *
 * Use this instead of the global Intl defaults whenever you render
 * a date, number, or currency to the user — it means the same amount
 * renders as ₹1,00,000 for an IN-locale tenant and $100,000.00 for
 * a US-locale tenant without any branching at the call site.
 */
export interface TenantLocale {
  locale: string
  timezone: string
  currency: string
  weekStartDay: number
}

function browserDefaults(): TenantLocale {
  if (typeof Intl === 'undefined') {
    return {
      locale: 'en-US',
      timezone: 'UTC',
      currency: 'USD',
      weekStartDay: 1,
    }
  }
  const opts = Intl.DateTimeFormat().resolvedOptions()
  return {
    locale: opts.locale || 'en-US',
    timezone: opts.timeZone || 'UTC',
    currency: 'USD',
    weekStartDay: 1,
  }
}

export function useLocale(): TenantLocale {
  const { current } = useTenant()
  const settings = current?.settings
  const defaults = browserDefaults()
  return {
    locale: settings?.locale || defaults.locale,
    timezone: settings?.timezone || defaults.timezone,
    currency: settings?.currency || defaults.currency,
    weekStartDay:
      typeof settings?.weekStartDay === 'number'
        ? settings.weekStartDay
        : defaults.weekStartDay,
  }
}
