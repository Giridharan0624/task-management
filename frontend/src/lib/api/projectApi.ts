import { apiClient } from './client'
import type { Project } from '@/types/project'
import type { ProjectMember, ProjectRole } from '@/types/user'

export interface CreateProjectData {
  name: string
  description?: string
  teamLeadId?: string
  projectManagerId?: string
  memberIds?: string[]
  domain?: string
}

export interface AddMemberData {
  userId: string
  /** Canonical role_id (e.g. 'project_manager') — preferred. */
  projectRoleId?: string
  /** Legacy enum — still accepted by the backend for backward
   *  compatibility. New code should set `projectRoleId` instead. */
  projectRole?: ProjectRole
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
  estimatedHours?: number
  domain?: string
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
  role: string,
): Promise<ProjectMember> {
  // `role` can be either a canonical role_id ('project_manager',
  // 'team_lead', or any tenant-defined custom project role) or a
  // legacy enum value ('ADMIN', 'PROJECT_MANAGER', 'TEAM_LEAD',
  // 'MEMBER'). Backend accepts either; we route new IDs through
  // `projectRoleId` and legacy strings through `projectRole` so
  // existing request-body validation doesn't need changing.
  const body = /^[a-z_]+$/.test(role)
    ? { projectRoleId: role }
    : { projectRole: role as ProjectRole }
  return apiClient.put<ProjectMember>(
    `/projects/${projectId}/members/${userId}/role`,
    body,
  )
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  return apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`)
}

export interface TaskProgress {
  taskId: string
  title: string
  status: string
  priority: string
  estimatedHours: number
  trackedHours: number
  statusProgress: number
  timeProgress: number
  isOverdue: boolean
  assignedTo: string[]
  deadline: string
}

export interface MemberProgress {
  userId: string
  name: string
  projectRole: string
  trackedHours: number
  totalTasks: number
  doneTasks: number
  completionPercent: number
}

export interface ProjectStatus {
  projectId: string
  projectName: string
  totalTasks: number
  taskCounts: Record<string, number>
  completionPercent: number
  weightedProgress: number
  overallScore: number
  timeBudgetPercent: number
  totalEstimatedHours: number
  totalTrackedHours: number
  health: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED'
  overdueCount: number
  atRiskCount: number
  onTrackCount: number
  taskProgress: TaskProgress[]
  memberProgress: MemberProgress[]
}

export async function getProjectStatus(projectId: string): Promise<ProjectStatus> {
  return apiClient.get<ProjectStatus>(`/projects/${projectId}/status`)
}
