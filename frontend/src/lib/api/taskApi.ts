import { apiClient } from './client'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'

export interface CreateTaskData {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  assignedTo?: string
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  assignedTo?: string
}

export async function getTasks(boardId: string): Promise<Task[]> {
  return apiClient.get<Task[]>(`/boards/${boardId}/tasks`)
}

export async function getTask(boardId: string, taskId: string): Promise<Task> {
  return apiClient.get<Task>(`/boards/${boardId}/tasks/${taskId}`)
}

export async function createTask(boardId: string, data: CreateTaskData): Promise<Task> {
  return apiClient.post<Task>(`/boards/${boardId}/tasks`, data)
}

export async function updateTask(
  boardId: string,
  taskId: string,
  data: UpdateTaskData
): Promise<Task> {
  return apiClient.put<Task>(`/boards/${boardId}/tasks/${taskId}`, data)
}

export async function deleteTask(boardId: string, taskId: string): Promise<void> {
  return apiClient.del<void>(`/boards/${boardId}/tasks/${taskId}`)
}

export async function assignTask(
  boardId: string,
  taskId: string,
  assignedTo: string
): Promise<Task> {
  return apiClient.put<Task>(`/boards/${boardId}/tasks/${taskId}/assign`, { assignedTo })
}
