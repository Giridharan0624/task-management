'use client'

import type { ProjectRole, SystemRole } from '@/types/user'

export interface Permissions {
  canCreateTask: boolean
  canUpdateTask: boolean
  canUpdateStatus: boolean
  canDeleteTask: boolean
  canAssignTask: boolean
  canManageMembers: boolean
  canDeleteProject: boolean
}

export interface SystemPermissions {
  canCreateProject: boolean
  canManageUsers: boolean
  canManageAdmins: boolean
  canViewProgress: boolean
  canAssignTasks: boolean
}

export function usePermission(projectRole?: ProjectRole, systemRole?: SystemRole): Permissions {
  const isOwner = systemRole === 'OWNER'
  const isSystemAdmin = systemRole === 'ADMIN'
  const isPrivileged = isOwner || isSystemAdmin
  const isMember = projectRole === 'MEMBER'

  return {
    canCreateTask: isPrivileged,
    canUpdateTask: isPrivileged,
    canUpdateStatus: isMember || isPrivileged,
    canDeleteTask: isPrivileged,
    canAssignTask: isPrivileged,
    canManageMembers: isPrivileged,
    canDeleteProject: isPrivileged,
  }
}

export function useSystemPermission(systemRole?: SystemRole): SystemPermissions {
  const isOwner = systemRole === 'OWNER'
  const isOwnerOrAdmin = systemRole === 'OWNER' || systemRole === 'ADMIN'

  return {
    canCreateProject: isOwnerOrAdmin,
    canManageUsers: isOwnerOrAdmin,
    canManageAdmins: isOwner,
    canViewProgress: isOwnerOrAdmin,
    canAssignTasks: isOwnerOrAdmin,
  }
}
