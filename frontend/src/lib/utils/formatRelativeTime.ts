/**
 * Format a date as a relative time string ("3m ago", "in 2h", "yesterday").
 * Returns an empty string for invalid input.
 */
export function formatRelativeTime(
  input: string | number | Date | null | undefined,
  now: Date = new Date()
): string {
  if (input == null) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''

  const diffMs = d.getTime() - now.getTime()
  const past = diffMs < 0
  const abs = Math.abs(diffMs)

  const SEC = 1000
  const MIN = 60 * SEC
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR

  if (abs < 45 * SEC) return past ? 'just now' : 'in a few seconds'
  if (abs < 90 * SEC) return past ? '1m ago' : 'in 1m'
  if (abs < 45 * MIN) {
    const m = Math.round(abs / MIN)
    return past ? `${m}m ago` : `in ${m}m`
  }
  if (abs < 90 * MIN) return past ? '1h ago' : 'in 1h'
  if (abs < 22 * HOUR) {
    const h = Math.round(abs / HOUR)
    return past ? `${h}h ago` : `in ${h}h`
  }
  if (abs < 36 * HOUR) return past ? 'yesterday' : 'tomorrow'
  if (abs < 26 * DAY) {
    const days = Math.round(abs / DAY)
    return past ? `${days}d ago` : `in ${days}d`
  }
  if (abs < 320 * DAY) {
    const months = Math.round(abs / (30 * DAY))
    return past ? `${months}mo ago` : `in ${months}mo`
  }
  const years = Math.round(abs / (365 * DAY))
  return past ? `${years}y ago` : `in ${years}y`
}

/**
 * Absolute-time tooltip value — localized. Optionally renders in a specific
 * IANA timezone (e.g. from the user's stored preference). Invalid timezone
 * names fall back to the browser default so we never render an empty tooltip.
 */
export function formatAbsoluteTime(
  input: string | number | Date | null | undefined,
  timezone?: string
): string {
  if (input == null) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
      timeZoneName: timezone ? 'short' : undefined,
    }).format(d)
  } catch {
    // Invalid tz — retry without it before giving up.
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d)
    } catch {
      return d.toISOString()
    }
  }
}
