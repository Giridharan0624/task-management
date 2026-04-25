import { apiClient } from './client'
import type { TaskUpdate, PendingTaskUpdate } from '@/types/taskupdate'

export function submitTaskUpdate(): Promise<TaskUpdate> {
  return apiClient.post<TaskUpdate>('/task-updates', {})
}

export function getTaskUpdates(date?: string): Promise<TaskUpdate[]> {
  const query = date ? `?date=${date}` : ''
  return apiClient.get<TaskUpdate[]>(`/task-updates${query}`)
}

export function getMyTaskUpdate(): Promise<TaskUpdate | PendingTaskUpdate | null> {
  return apiClient.get<TaskUpdate | PendingTaskUpdate | null>('/task-updates/me')
}

// NOTE — the shared `apiClient` runs snake_case → camelCase on every
// response body, so every field in these types MUST be camelCase. The
// backend emits snake_case on the wire and the transform handles the
// rename. Writing snake_case here (as this file used to) produced
// `undefined` at every call site.

export interface WeeklyRollupContributor {
  name: string
  updates: number
  hours: number
  tasks: number
}

export interface WeeklyRollupTask {
  taskName: string
  hours: number
  contributors: number
  updates: number
}

export interface WeeklyRollupDay {
  date: string
  updates: number
  hours: number
}

export interface WeeklyRollupAttendanceDay {
  date: string
  hours: number
  sessions: number
  signedInCount: number
}

export interface WeeklyRollupAttendanceContributor {
  name: string
  hours: number
  sessions: number
}

export interface WeeklyRollupApp {
  appName: string
  minutes: number
}

export interface WeeklyRollupDayOff {
  name: string
  startDate: string
  endDate: string
  daysInWindow: number
  reason: string
}

export interface WeeklyRollupNarrative {
  headline: string
  summary: string
  highlights: string[]
  notablePatterns: string[]
  concerns: string[]
}

/** A deterministically-detected anomaly from the week. Computed by the
 *  backend (not the AI), so the figures and triggers are reliable. The
 *  AI is allowed — and encouraged — to paraphrase these in concerns. */
export interface WeeklyRollupAnomaly {
  kind:
    | 'zero_activity'
    | 'solo_load'
    | 'overtime_day'
    | 'low_focus'
    | 'mass_missing_day'
    | 'task_mono_focus'
    | string
  severity: 'info' | 'warn' | 'alert'
  title: string
  detail: string
  /** Optional — present when the anomaly targets one specific member. */
  subject?: string
}

export interface WeeklyRollup {
  weekStart: string
  weekEnd: string
  teamSize: number
  metrics: {
    totalUpdates: number
    contributorCount: number
    totalHours: number
    missingDays: string[]
    // Attendance slice (objective timer)
    attendanceTotalHours: number
    attendanceContributorCount: number
    attendanceSessionsCount: number
    // Activity slice (desktop signals)
    activityAvgScore: number
    activityTotalActiveMinutes: number
    activityTotalIdleMinutes: number
    activityContributorCount: number
    // Day-off slice
    dayoffsApprovedCount: number
    dayoffsDaysLost: number
  }
  byContributor: WeeklyRollupContributor[]
  byTask: WeeklyRollupTask[]
  byDay: WeeklyRollupDay[]
  attendanceByDay: WeeklyRollupAttendanceDay[]
  attendanceByContributor: WeeklyRollupAttendanceContributor[]
  activityTopApps: WeeklyRollupApp[]
  dayoffsRequests: WeeklyRollupDayOff[]
  /** Deterministic anomalies detected for this week. Empty when clean. */
  anomalies: WeeklyRollupAnomaly[]
  narrative: WeeklyRollupNarrative
  generatedAt: string
}

/** Fetches the owner/admin weekly rollup. `weekStart` is an optional
 *  YYYY-MM-DD — any date inside the target week works; the backend
 *  snaps it to the Monday of that week before aggregating.
 *
 *  `regenerate=true` bypasses the server-side cache and forces a fresh
 *  Groq generation, then overwrites the cached row. Only the explicit
 *  "Regenerate" button passes this flag — every other access reads the
 *  cached payload to keep AI token costs predictable. */
export function getWeeklyRollup(
  weekStart?: string,
  regenerate = false,
): Promise<WeeklyRollup> {
  const params = new URLSearchParams()
  if (weekStart) params.set('week_start', weekStart)
  if (regenerate) params.set('regenerate', 'true')
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiClient.get<WeeklyRollup>(`/task-updates/weekly-rollup${query}`)
}
