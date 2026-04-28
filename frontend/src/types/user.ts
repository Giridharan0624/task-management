export type SystemRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type ProjectRole = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_LEAD' | 'MEMBER'

export interface User {
  userId: string
  employeeId?: string
  email: string
  name: string
  systemRole: SystemRole
  /** True when the user has completed the email-verification code
   *  challenge. Signup creates users with this false; invite acceptance
   *  ships true because the invite link was sent to the same email.
   *  Undefined = legacy token pre-verification rollout; treat as true
   *  for backward compat. */
  emailVerified?: boolean
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
  /** Server-persisted flag — true once the user has finished or
   *  skipped the first-login guided tour. Surviving across browsers,
   *  devices, and incognito sessions instead of localStorage-only. */
  walkthroughSeen?: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectMember {
  projectId: string
  userId: string
  /** Legacy enum value. Backend emits this for backward compatibility;
   *  consumers should migrate to `projectRoleId` which is the canonical
   *  post-refactor field and supports tenant-defined custom roles. */
  projectRole: ProjectRole
  /** Canonical project-scope role_id (e.g. 'project_admin',
   *  'project_manager', 'team_lead', 'project_member', or any tenant-
   *  defined custom role with scope='project'). Fetched from
   *  `/orgs/current/roles` filtered to `scope === 'project'`. */
  projectRoleId?: string
  addedBy?: string
  addedByName?: string
  joinedAt: string
  user?: User
}
