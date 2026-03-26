'use client'

import type { BoardRole, SystemRole } from '@/types/user'

export interface Permissions {
  canCreateTask: boolean
  canUpdateTask: boolean
  canDeleteTask: boolean
  canManageMembers: boolean
  canDeleteBoard: boolean
}

export interface SystemPermissions {
  canCreateBoard: boolean
  canManageUsers: boolean
  canManageAdmins: boolean
  canViewProgress: boolean
  canAssignTasks: boolean
}

export function usePermission(boardRole?: BoardRole): Permissions {
  const isAdmin = boardRole === 'ADMIN'
  const isAdminOrMember = boardRole === 'ADMIN' || boardRole === 'MEMBER'

  return {
    canCreateTask: isAdminOrMember,
    canUpdateTask: isAdminOrMember,
    canDeleteTask: isAdmin,
    canManageMembers: isAdmin,
    canDeleteBoard: isAdmin,
  }
}

export function useSystemPermission(systemRole?: SystemRole): SystemPermissions {
  const isOwner = systemRole === 'OWNER'
  const isOwnerOrAdmin = systemRole === 'OWNER' || systemRole === 'ADMIN'

  return {
    canCreateBoard: isOwnerOrAdmin,
    canManageUsers: isOwnerOrAdmin,
    canManageAdmins: isOwner,
    canViewProgress: isOwnerOrAdmin,
    canAssignTasks: isOwnerOrAdmin,
  }
}
