import { apiClient } from './client'

export interface ActivityBucket {
  timestamp: string
  keyboardCount: number
  mouseCount: number
  activeSeconds: number
  idleSeconds: number
  topApp: string | null
  appBreakdown: Record<string, number>
  screenshotUrl: string | null
}

export interface Screenshot {
  url: string
  timestamp: string
}

export interface UserActivity {
  userId: string
  date: string
  buckets: ActivityBucket[]
  totalActiveMinutes: number
  totalIdleMinutes: number
  activityScore: number
  appUsage: Record<string, number>
  screenshots: Screenshot[]
  userName: string
  userEmail: string
  bucketCount: number
}

export interface DailySummary {
  userId: string
  date: string
  summary: string
  keyActivities: string[]
  productivityScore: number
  concerns: string[]
  totalActiveMinutes: number
  totalIdleMinutes: number
  appUsage: Record<string, number>
  generatedAt: string
  userName: string
}

export function getMyActivity(date?: string): Promise<UserActivity | null> {
  const query = date ? `?date=${date}` : ''
  return apiClient.get<UserActivity | null>(`/activity/me${query}`)
}

export function getActivityReport(startDate: string, endDate: string): Promise<UserActivity[]> {
  return apiClient.get<UserActivity[]>(`/activity/report?startDate=${startDate}&endDate=${endDate}`)
}

export function generateSummary(userId: string, date: string, taskContext?: string): Promise<DailySummary> {
  return apiClient.post<DailySummary>('/activity/summary', {
    userId, date, taskContext,
  })
}

export function getSummary(userId: string, date: string): Promise<DailySummary | null> {
  return apiClient.get<DailySummary | null>(`/activity/summary?userId=${userId}&date=${date}`)
}
