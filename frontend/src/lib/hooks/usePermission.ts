import type { BoardRole } from '@/types/user'

export interface Permissions {
  canCreateTask: boolean
  canUpdateTask: boolean
  canDeleteTask: boolean
  canManageMembers: boolean
  canDeleteBoard: boolean
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
