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

export interface UpdateProfileData {
  name?: string
  phone?: string
  designation?: string
  department?: string
  location?: string
  bio?: string
  avatarUrl?: string
  skills?: string[]
  dateOfBirth?: string
  collegeName?: string
  areaOfInterest?: string
  hobby?: string
  companyPrefix?: string
}

export function updateProfile(data: UpdateProfileData): Promise<User> {
  return apiClient.put<User>('/users/me', data)
}

export function updateUserRole(userId: string, systemRole: string): Promise<User> {
  return apiClient.put<User>('/users/role', { userId, systemRole })
}

export function updateUserDepartment(userId: string, department: string): Promise<User> {
  return apiClient.put<User>('/users/department', { userId, department })
}

export function getUserProgress(userId: string): Promise<UserProgress> {
  return apiClient.get<UserProgress>(`/users/${userId}/progress`)
}

export function createUser(data: { email: string; name: string; systemRole: string; department: string; dateOfJoining?: string }): Promise<User> {
  return apiClient.post<User>('/users', data)
}

export function deleteUser(userId: string): Promise<void> {
  return apiClient.del<void>(`/users/${userId}`)
}

export interface AdminInfo {
  userId: string
  name: string
  email: string
  employeeId?: string
}

export function getAdmins(): Promise<AdminInfo[]> {
  return apiClient.get<AdminInfo[]>('/users/admins')
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
  assignedBy?: string
  assignedByName?: string
  createdBy: string
  createdByName?: string
  domain?: string
  deadline: string
  createdAt: string
  updatedAt: string
}

export function getMyTasks(): Promise<MyTask[]> {
  return apiClient.get<MyTask[]>('/users/me/tasks')
}
