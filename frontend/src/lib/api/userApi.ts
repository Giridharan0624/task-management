import { apiClient } from './client'
import type { User } from '@/types/user'

export interface UserProgress {
  user: User
  projects: {
    projectId: string
    projectName: string
    tasks: import('@/types/task').Task[]
    stats: { TODO: number; IN_PROGRESS: number; DONE: number }
  }[]
  totalStats: { TODO: number; IN_PROGRESS: number; DONE: number; total: number }
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
  return apiClient.put<User>('/users/role', { userId, systemRole })
}

export function getUserProgress(userId: string): Promise<UserProgress> {
  return apiClient.get<UserProgress>(`/users/${userId}/progress`)
}

export function createUser(data: { email: string; name: string; password: string; systemRole: string }): Promise<User> {
  return apiClient.post<User>('/users', data)
}

export function deleteUser(userId: string): Promise<void> {
  return apiClient.del<void>(`/users/${userId}`)
}

export interface MyTask {
  taskId: string
  projectId: string
  projectName: string
  title: string
  description?: string
  status: import('@/types/task').TaskStatus
  priority: import('@/types/task').TaskPriority
  assignedTo: string[]
  deadline: string
  createdAt: string
  updatedAt: string
}

export function getMyTasks(): Promise<MyTask[]> {
  return apiClient.get<MyTask[]>('/users/me/tasks')
}
