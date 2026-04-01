import type { ProjectMember } from './user'

export interface Project {
  projectId: string
  name: string
  description?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  estimatedHours?: number
  domain?: string
  members?: ProjectMember[]
  memberCount?: number
  taskCount?: number
  doneCount?: number
  inProgressCount?: number
  completionPercent?: number
}
