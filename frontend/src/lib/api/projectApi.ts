import { apiClient } from './client'
import type { Project } from '@/types/project'
import type { ProjectMember, ProjectRole } from '@/types/user'

export interface CreateProjectData {
  name: string
  description?: string
}

export interface AddMemberData {
  userId: string
  projectRole: ProjectRole
}

export async function getProjects(): Promise<Project[]> {
  return apiClient.get<Project[]>('/projects')
}

export async function getProject(projectId: string): Promise<Project> {
  return apiClient.get<Project>(`/projects/${projectId}`)
}

export async function createProject(data: CreateProjectData): Promise<Project> {
  return apiClient.post<Project>('/projects', data)
}

export interface UpdateProjectData {
  name?: string
  description?: string
}

export async function updateProject(projectId: string, data: UpdateProjectData): Promise<Project> {
  return apiClient.put<Project>(`/projects/${projectId}`, data)
}

export async function deleteProject(projectId: string): Promise<void> {
  return apiClient.del<void>(`/projects/${projectId}`)
}

export async function addProjectMember(projectId: string, data: AddMemberData): Promise<ProjectMember> {
  return apiClient.post<ProjectMember>(`/projects/${projectId}/members`, data)
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  return apiClient.del<void>(`/projects/${projectId}/members/${userId}`)
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  projectRole: ProjectRole
): Promise<ProjectMember> {
  return apiClient.put<ProjectMember>(`/projects/${projectId}/members/${userId}/role`, { projectRole })
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`)
}
