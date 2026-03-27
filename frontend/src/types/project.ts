import type { ProjectMember } from './user'

export interface Project {
  projectId: string
  name: string
  description?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  members?: ProjectMember[]
  memberCount?: number
}
