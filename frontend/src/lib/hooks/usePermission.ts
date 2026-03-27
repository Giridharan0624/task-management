'use client'

import type { ProjectRole, SystemRole } from '@/types/user'

export interface Permissions {
  canCreateTask: boolean
  canUpdateTask: boolean
  canDeleteTask: boolean
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
  const isAdmin = projectRole === 'ADMIN'
  const isAdminOrMember = projectRole === 'ADMIN' || projectRole === 'MEMBER'

  return {
    canCreateTask: isOwner || isAdminOrMember,
    canUpdateTask: isOwner || isAdminOrMember,
    canDeleteTask: isOwner || isAdmin,
    canManageMembers: isOwner || isAdmin,
    canDeleteProject: isOwner || isAdmin,
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
