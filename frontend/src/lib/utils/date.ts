/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone (not UTC).
 * Fixes the issue where toISOString() returns UTC date which can differ from local date.
 */
export function getLocalToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
