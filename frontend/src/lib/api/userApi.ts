import { apiClient } from './client'
import type { User } from '@/types/user'

export interface UserProgress {
  user: User
  projects: {
    projectId: string
    projectName: string
    tasks: import('@/types/task').Task[]
    stats: { TODO: number; IN_PROGRESS: number; DONE: number }
  }[]
  totalStats: { TODO: number; IN_PROGRESS: number; DONE: number; total: number }
}

export function getUsers(): Promise<User[]> {
  return apiClient.get<User[]>('/users')
}

export function getProfile(): Promise<User> {
  return apiClient.get<User>('/users/me')
}

export interface UpdateProfileData {
  name?: string
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
}

export function updateProfile(data: UpdateProfileData): Promise<User> {
  return apiClient.put<User>('/users/me', data)
}

export function updateUserRole(userId: string, systemRole: string): Promise<User> {
  return apiClient.put<User>('/users/role', { userId, systemRole })
}

export function updateUserDepartment(userId: string, department: string): Promise<User> {
  return apiClient.put<User>('/users/department', { userId, department })
}

export function getUserProgress(userId: string): Promise<UserProgress> {
  return apiClient.get<UserProgress>(`/users/${userId}/progress`)
}

export function createUser(data: { email: string; name: string; systemRole: string; department: string; dateOfJoining?: string }): Promise<User> {
  return apiClient.post<User>('/users', data)
}

export interface BulkUserRow {
  email: string
  name: string
  /** Stored canonical form: uppercase ADMIN/MEMBER for the built-in
   *  tiers; lowercase role_id for any tenant-defined custom system
   *  role. The backend validates the value against the org's role
   *  records — same path as CreateUserUseCase._resolve_target_role. */
  systemRole: string
  department?: string
  dateOfJoining?: string
}

export interface BulkCreateResult {
  created: Array<{
    row: number
    email: string
    userId: string
    employeeId: string
    otp: string
  }>
  failed: Array<{
    row: number
    email: string
    error: string
  }>
  summary: {
    requested: number
    created: number
    failed: number
  }
}

/** POST /users/bulk — backend iterates the single-user create flow
 *  per row. Always resolves with a 200 response; row-level errors are
 *  in `failed[]`. Max 200 rows per request. */
export function bulkCreateUsers(users: BulkUserRow[]): Promise<BulkCreateResult> {
  return apiClient.post<BulkCreateResult>('/users/bulk', { users })
}

/** PUT /users/me/email — tell the backend our JWT email has changed
 *  so the DDB User record gets rewritten. Cognito handles the actual
 *  email mutation + verification via SDK calls; this is the sync
 *  follow-up called after `refreshSession()`. */
export function syncEmail(): Promise<{
  email: string
  updated: boolean
  previousEmail?: string
}> {
  return apiClient.put('/users/me/email', {})
}

/** POST /users/{userId}/mfa/reset — OWNER-only. Disables the target's
 *  TOTP factor in Cognito so they can sign in with password alone and
 *  re-enroll from /profile/mfa. Recovery escape hatch for lost
 *  authenticators. */
export function resetUserMfa(userId: string): Promise<{
  userId: string
  email: string
  mfaResetAt: string
}> {
  return apiClient.post(
    `/users/${encodeURIComponent(userId)}/mfa/reset`,
    {},
  )
}

export function deleteUser(userId: string): Promise<void> {
  return apiClient.del<void>(`/users/${userId}`)
}

export interface AdminInfo {
  userId: string
  name: string
  email: string
  employeeId?: string
}

export function getAdmins(): Promise<AdminInfo[]> {
  return apiClient.get<AdminInfo[]>('/users/admins')
}

export interface MyTask {
  taskId: string
  projectId: string
  projectName: string
  title: string
  description?: string
  status: import('@/types/task').TaskStatus
  priority: import('@/types/task').TaskPriority
  assignedTo: string[]
  assignedBy?: string
  assignedByName?: string
  createdBy: string
  createdByName?: string
  domain?: string
  deadline: string
  createdAt: string
  updatedAt: string
}

export function getMyTasks(): Promise<MyTask[]> {
  return apiClient.get<MyTask[]>('/users/me/tasks')
}

export interface BirthdayUser {
  userId: string
  name: string
  avatarUrl?: string
  designation?: string
  department?: string
  dateOfBirth: string
  daysUntil?: number
}

export interface BirthdayData {
  today: BirthdayUser[]
  upcoming: BirthdayUser[]
}

export function getBirthdays(): Promise<BirthdayData> {
  return apiClient.get<BirthdayData>('/users/birthdays')
}
