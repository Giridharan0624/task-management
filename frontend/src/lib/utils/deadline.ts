/**
 * Parse a deadline string into a Date, treating date-only values as end of day (23:59:59).
 * "2026-04-01" → 2026-04-01T23:59:59
 * "2026-04-01T08:30" → 2026-04-01T08:30:00 (as-is)
 */
export function parseDeadline(deadline: string): Date {
  // If it's just a date (no T), treat as end of day
  if (deadline.length === 10 || !deadline.includes('T')) {
    return new Date(deadline + 'T23:59:59')
  }
  return new Date(deadline)
}

/**
 * Check if a deadline is overdue (past the deadline time).
 * Date-only deadlines are considered overdue after the end of that day.
 */
export function isOverdue(deadline: string | undefined | null, status?: string): boolean {
  if (!deadline || status === 'DONE') return false
  return parseDeadline(deadline) < new Date()
}
