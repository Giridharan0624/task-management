/**
 * Format a decimal hours value as "Xh Ym Zs".
 * Omits zero segments except when all are zero (shows "0s").
 */
export function formatDuration(decimalHours: number): string {
  if (decimalHours <= 0) return '0s'

  const totalSeconds = Math.round(decimalHours * 3600)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0 || parts.length === 0) parts.push(`${s}s`)

  return parts.join(' ')
}
