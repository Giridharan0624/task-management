/**
 * Builds a CSV filename that makes the exporting user's timezone unambiguous.
 * A report named `attendance-2026-04-21.csv` means different days for a user
 * in Tokyo vs one in Los Angeles; appending the IANA zone slug removes the
 * confusion without polluting the UI.
 *
 * Examples:
 *   buildCsvName('attendance', '2026-04-21')
 *     → "attendance-2026-04-21-Asia_Kolkata.csv"
 *   buildCsvName('time-report', '2026-04-01', '2026-04-21')
 *     → "time-report-2026-04-01-2026-04-21-America_New_York.csv"
 */
export function buildCsvName(
  prefix: string,
  ...rangeParts: (string | undefined)[]
): string {
  const parts = [prefix, ...rangeParts.filter((p): p is string => Boolean(p))]

  const tz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC'
  // Slashes aren't legal on Windows and look ugly on macOS; swap for `_`.
  // "Asia/Kolkata" → "Asia_Kolkata".
  const safeTz = tz.replace(/[\/]/g, '_')

  return `${parts.join('-')}-${safeTz}.csv`
}
