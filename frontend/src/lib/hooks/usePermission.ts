'use client'

import type { ProjectRole, SystemRole } from '@/types/user'

const PRIVILEGED: SystemRole[] = ['OWNER', 'ADMIN']

function isPrivileged(role?: SystemRole) {
  return !!role && PRIVILEGED.includes(role)
}

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
  canApproveDayOffs: boolean
}

export function usePermission(projectRole?: ProjectRole, systemRole?: SystemRole): Permissions {
  const priv = isPrivileged(systemRole)
  const isTeamLead = projectRole === 'TEAM_LEAD'
  const isProjectManager = projectRole === 'PROJECT_MANAGER'
  const canManage = priv || isProjectManager || isTeamLead
  const isMember = projectRole === 'MEMBER'

  return {
    canCreateTask: canManage,
    canUpdateTask: canManage,
    canUpdateStatus: isMember || canManage,
    canDeleteTask: canManage,
    canAssignTask: canManage,
    canManageMembers: canManage,
    canDeleteProject: priv,
  }
}

export function useSystemPermission(systemRole?: SystemRole): SystemPermissions {
  const priv = isPrivileged(systemRole)

  return {
    canCreateProject: priv,
    canManageUsers: priv,
    canManageAdmins: systemRole === 'OWNER',
    canViewProgress: priv,
    canAssignTasks: priv,
    canApproveDayOffs: priv,
  }
}
