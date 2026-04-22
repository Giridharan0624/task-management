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

export interface WeeklyRollupContributor {
  name: string
  updates: number
  hours: number
  tasks: number
}

export interface WeeklyRollupTask {
  task_name: string
  hours: number
  contributors: number
  updates: number
}

export interface WeeklyRollupDay {
  date: string
  updates: number
  hours: number
}

export interface WeeklyRollupNarrative {
  headline: string
  summary: string
  highlights: string[]
  notable_patterns: string[]
  concerns: string[]
}

export interface WeeklyRollup {
  week_start: string
  week_end: string
  team_size: number
  metrics: {
    total_updates: number
    contributor_count: number
    total_hours: number
    missing_days: string[]
  }
  by_contributor: WeeklyRollupContributor[]
  by_task: WeeklyRollupTask[]
  by_day: WeeklyRollupDay[]
  narrative: WeeklyRollupNarrative
  generated_at: string
}

/** Fetches the owner/admin weekly rollup. `weekStart` is an optional
 *  YYYY-MM-DD — any date inside the target week works; the backend
 *  snaps it to the Monday of that week before aggregating. */
export function getWeeklyRollup(weekStart?: string): Promise<WeeklyRollup> {
  const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : ''
  return apiClient.get<WeeklyRollup>(`/task-updates/weekly-rollup${query}`)
}
