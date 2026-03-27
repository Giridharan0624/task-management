export type SystemRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ProjectRole = 'ADMIN' | 'TEAM_LEAD' | 'MEMBER'

export interface User {
  userId: string
  email: string
  name: string
  systemRole: SystemRole
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  projectId: string
  userId: string
  projectRole: ProjectRole
  joinedAt: string
  user?: User
}
