export type SystemRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ProjectRole = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_LEAD' | 'MEMBER'

export interface User {
  userId: string
  employeeId?: string
  email: string
  name: string
  systemRole: SystemRole
  createdBy?: string
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
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  projectId: string
  userId: string
  projectRole: ProjectRole
  addedBy?: string
  addedByName?: string
  joinedAt: string
  user?: User
}
