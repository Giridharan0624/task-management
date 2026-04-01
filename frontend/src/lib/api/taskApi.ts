import { apiClient } from './client'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'

export interface CreateTaskData {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  deadline: string
  estimatedHours?: number
  assignedTo?: string[]
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  domain?: string
  deadline?: string
  estimatedHours?: number
  assignedTo?: string[]
}

export async function getTasks(projectId: string): Promise<Task[]> {
  return apiClient.get<Task[]>(`/projects/${projectId}/tasks`)
}

export async function getTask(projectId: string, taskId: string): Promise<Task> {
  return apiClient.get<Task>(`/projects/${projectId}/tasks/${taskId}`)
}

export async function createTask(projectId: string, data: CreateTaskData): Promise<Task> {
  return apiClient.post<Task>(`/projects/${projectId}/tasks`, data)
}

export async function updateTask(
  projectId: string,
  taskId: string,
  data: UpdateTaskData
): Promise<Task> {
  return apiClient.put<Task>(`/projects/${projectId}/tasks/${taskId}`, data)
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  return apiClient.del<void>(`/projects/${projectId}/tasks/${taskId}`)
}

export async function assignTask(
  projectId: string,
  taskId: string,
  assignedTo: string[]
): Promise<Task> {
  return apiClient.put<Task>(`/projects/${projectId}/tasks/${taskId}/assign`, { assignedTo })
}
