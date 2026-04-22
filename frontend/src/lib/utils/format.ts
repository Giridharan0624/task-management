/**
 * Locale-aware format helpers. Every function accepts an optional
 * `locale` + timezone / currency parameters so either a call site
 * can pass them explicitly, or a hook wrapper (see
 * `lib/tenant/useLocale`) can inject the current tenant's settings.
 *
 * Design: the raw functions are pure + locale-explicit so they're
 * trivially testable + Server-Component-safe. The `useFormat()` hook
 * below binds them to the current tenant context for client code.
 */

// ─── Pure, locale-explicit helpers ──────────────────────────────────

/**
 * Format a date as a medium-length localised string (e.g.
 * "15 Jan 2026" / "Jan 15, 2026" depending on locale). Accepts ISO
 * strings, Date objects, or epoch millis.
 */
export function formatDate(
  value: string | number | Date,
  locale: string = 'en-US',
  timezone: string = 'UTC',
  opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: timezone }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/**
 * Format a time-of-day (24h or 12h depending on locale). Takes the
 * same input as `formatDate`.
 */
export function formatTime(
  value: string | number | Date,
  locale: string = 'en-US',
  timezone: string = 'UTC',
  opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: timezone }).format(d)
  } catch {
    return ''
  }
}

/**
 * Format a number with grouping separators appropriate to the locale
 * (e.g. "10,000" vs "10 000" vs "10.000").
 */
export function formatNumber(
  value: number,
  locale: string = 'en-US',
  opts?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return String(value)
  try {
    return new Intl.NumberFormat(locale, opts).format(value)
  } catch {
    return String(value)
  }
}

/**
 * Format a money amount with the right symbol + grouping. Pass the
 * tenant's configured currency (ISO-4217).
 */
export function formatCurrency(
  value: number,
  locale: string = 'en-US',
  currency: string = 'USD',
  opts: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return String(value)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      ...opts,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

/**
 * Short relative time ("2m ago", "3d ago"). Locale-aware via
 * `Intl.RelativeTimeFormat`. Input is an ISO date string, number
 * (epoch ms), or Date.
 */
export function formatRelative(
  value: string | number | Date,
  locale: string = 'en-US',
): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = d.getTime() - Date.now()
  const absSec = Math.abs(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (absSec >= seconds) {
      const count = Math.round(diffMs / 1000 / seconds)
      return rtf.format(count, unit)
    }
  }
  return rtf.format(Math.round(diffMs / 1000), 'second')
}
