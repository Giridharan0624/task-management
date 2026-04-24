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
  narrative: WeeklyRollupNarrative
  generatedAt: string
}

/** Fetches the owner/admin weekly rollup. `weekStart` is an optional
 *  YYYY-MM-DD — any date inside the target week works; the backend
 *  snaps it to the Monday of that week before aggregating. */
export function getWeeklyRollup(weekStart?: string): Promise<WeeklyRollup> {
  const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''
  return apiClient.get<WeeklyRollup>(`/task-updates/weekly-rollup${query}`)
}
