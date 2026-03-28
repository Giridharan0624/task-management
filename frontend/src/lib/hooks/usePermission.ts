'use client'

import type { ProjectRole, SystemRole } from '@/types/user'

const TOP_TIER: SystemRole[] = ['OWNER', 'CEO', 'MD']
const PRIVILEGED: SystemRole[] = ['OWNER', 'CEO', 'MD', 'ADMIN']

function isTopTier(role?: SystemRole) {
  return !!role && TOP_TIER.includes(role)
}

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
  canCreateCeoMd: boolean
  canViewProgress: boolean
  canAssignTasks: boolean
}

export function usePermission(projectRole?: ProjectRole, systemRole?: SystemRole): Permissions {
  const priv = isPrivileged(systemRole)
  const isTeamLead = projectRole === 'TEAM_LEAD'
  const canManage = priv || isTeamLead
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
  const top = isTopTier(systemRole)
  const priv = isPrivileged(systemRole)

  return {
    canCreateProject: priv,
    canManageUsers: priv,
    canManageAdmins: top,
    canCreateCeoMd: systemRole === 'OWNER',
    canViewProgress: priv,
    canAssignTasks: priv,
  }
}
