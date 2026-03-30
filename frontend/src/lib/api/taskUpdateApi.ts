import { apiClient } from './client'
import type { TaskUpdate } from '@/types/taskupdate'

export function submitTaskUpdate(): Promise<TaskUpdate> {
  return apiClient.post<TaskUpdate>('/task-updates', {})
}

export function getTaskUpdates(date?: string): Promise<TaskUpdate[]> {
  const query = date ? `?date=${date}` : ''
  return apiClient.get<TaskUpdate[]>(`/task-updates${query}`)
}

export function getMyTaskUpdate(): Promise<TaskUpdate | null> {
  return apiClient.get<TaskUpdate | null>('/task-updates/me')
}
