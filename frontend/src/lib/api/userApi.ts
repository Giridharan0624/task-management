import { apiClient } from './client'
import type { User } from '@/types/user'

export interface UserProgress {
  user: User
  boards: {
    board_id: string
    board_name: string
    tasks: import('@/types/task').Task[]
    stats: { TODO: number; IN_PROGRESS: number; DONE: number }
  }[]
  total_stats: { TODO: number; IN_PROGRESS: number; DONE: number; total: number }
}

export function getUsers(): Promise<User[]> {
  return apiClient.get<User[]>('/users')
}

export function getProfile(): Promise<User> {
  return apiClient.get<User>('/users/me')
}

export function updateProfile(data: { name: string }): Promise<User> {
  return apiClient.put<User>('/users/me', data)
}

export function updateUserRole(userId: string, systemRole: string): Promise<User> {
  return apiClient.put<User>('/users/role', { user_id: userId, system_role: systemRole })
}

export function getUserProgress(userId: string): Promise<UserProgress> {
  return apiClient.get<UserProgress>(`/users/${userId}/progress`)
}
