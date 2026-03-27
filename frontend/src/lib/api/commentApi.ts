import { apiClient } from './client'
import type { ProgressComment } from '@/types/comment'

export function getComments(projectId: string, taskId: string): Promise<ProgressComment[]> {
  return apiClient.get<ProgressComment[]>(`/projects/${projectId}/tasks/${taskId}/comments`)
}

export function createComment(projectId: string, taskId: string, message: string): Promise<ProgressComment> {
  return apiClient.post<ProgressComment>(`/projects/${projectId}/tasks/${taskId}/comments`, { message })
}
