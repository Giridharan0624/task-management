import { serverNow } from './serverClock'

/**
 * Calculate hours for a session.
 * - Active sessions (no signOutAt): returns live elapsed from signInAt,
 *   ticking against the server-synced clock so the displayed value
 *   matches what the desktop app (and any other tab) shows.
 * - Completed sessions: returns stored hours, or calculates from timestamps if hours is 0/null
 */
export function getSessionHours(session: { signInAt: string; signOutAt: string | null; hours: number | null }): number {
  // Active session — calculate live against serverNow() so the
  // displayed total agrees across devices regardless of local OS
  // clock accuracy.
  if (!session.signOutAt && session.signInAt) {
    return Math.max(0, (serverNow() - new Date(session.signInAt).getTime()) / 3600000)
  }

  // Completed session with stored hours
  if (session.hours != null && session.hours > 0) return session.hours

  // Completed session with 0 or null hours — calculate from timestamps
  if (session.signOutAt && session.signInAt) {
    return Math.max(0, (new Date(session.signOutAt).getTime() - new Date(session.signInAt).getTime()) / 3600000)
  }

  return 0
}
