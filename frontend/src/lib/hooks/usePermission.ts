'use client'

import { useMemo } from 'react'
import type { ProjectRole, SystemRole } from '@/types/user'
import { useRoles } from '@/lib/hooks/useRoles'
import { useAuth } from '@/lib/auth/AuthProvider'

/**
 * Live-permission hooks. Every product-facing `canXxx` boolean on the
 * returned objects resolves against the **current user's effective
 * permission set** — read from the per-tenant Role record stored at
 * `ORG#{org}#ROLE#{role_id}` via the `/orgs/current/roles` endpoint
 * and cached by React Query.
 *
 * The net effect: when an OWNER removes `dayoff.approve` from the
 * Admin role in /settings/roles, Admins' "Approve" buttons disappear
 * at the next refetch of that endpoint (~10-30s React Query
 * staleTime), without a page reload and without a backend deploy.
 *
 * Before Session 8 these hooks returned booleans from a static
 * `systemRole → permissions` map. That ignored tenant edits — the UI
 * kept showing controls even after the backend had revoked the
 * permission. This module replaces that map with a live lookup.
 *
 * Loading fallback: while the roles list is in-flight we fall back to
 * the hardcoded map (the same map the old implementation used). This
 * keeps the first-paint experience snappy — a MEMBER doesn't briefly
 * see admin-only UI while roles load.
 */

const PRIVILEGED: SystemRole[] = ['OWNER', 'ADMIN']

function isPrivilegedFallback(role?: SystemRole): boolean {
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
  /**
   * True while the /orgs/current/roles fetch is in flight. Every
   * `canXxx` boolean above reflects the legacy role-based fallback
   * during this window — accurate for the three built-in tiers
   * (OWNER/ADMIN/MEMBER) but pessimistic for custom privileged roles,
   * which would flash "no permission" if a page-gate used the
   * booleans alone. Page gates should defer until `isLoading` is
   * false OR the legacy fallback is known to be correct (e.g. when
   * user.systemRole ∈ {OWNER, ADMIN, MEMBER}).
   */
  isLoading: boolean
}

/**
 * Resolve the caller's effective permission set by matching their
 * `user.systemRole` against the fetched role records, falling back to
 * `null` when roles are still loading (caller decides whether to use
 * the hardcoded safety net).
 *
 * Exported so layout-level components (the sidebar, admin route
 * guards) can filter a whole set of affordances with a single hook
 * call instead of calling `useHasPermission` once per permission.
 */
export function useEffectivePermissions(): Set<string> | null {
  const { user } = useAuth()
  const { roles, isLoading } = useRoles()
  return useMemo(() => {
    if (isLoading || !user) return null
    // `custom:systemRole` comes back uppercased from the JWT
    // (`OWNER` / `ADMIN` / `MEMBER`) but role_id stored in DDB is
    // lowercase. Try both forms.
    const needle = user.systemRole.toLowerCase()
    const hit =
      roles.find((r) => r.roleId === needle) ??
      roles.find((r) => r.roleId === user.systemRole)
    if (!hit) return null
    return new Set(hit.permissions)
  }, [user, roles, isLoading])
}

/**
 * Project-scope permissions. The inline project role carries its own
 * (project_admin / project_manager / team_lead / project_member or
 * tenant-defined custom) permission set. For the core product
 * decisions below we read them live when possible, but fall back to
 * the legacy role-name heuristics for compatibility with call sites
 * that still pass the upper-case enum form.
 *
 * Note: `canCreateTask` etc. also check system-scope `task.manage` so
 * an OWNER/ADMIN can act on any project without joining it.
 */
export function usePermission(
  projectRole?: ProjectRole,
  systemRole?: SystemRole,
): Permissions {
  const sysPerms = useEffectivePermissions()
  const systemHas = (perm: string): boolean => {
    if (sysPerms) return sysPerms.has(perm)
    // Fallback while loading: same shape as the pre-Session-8 hook.
    return isPrivilegedFallback(systemRole)
  }

  const priv = isPrivilegedFallback(systemRole)
  // Project-scope roles use the legacy enum strings here — migrating
  // these to live per-org project-role permissions is tracked
  // separately. For now match the pre-existing behavior so we don't
  // regress project-member UX while closing the system-scope gap.
  const isTeamLead = projectRole === 'TEAM_LEAD'
  const isProjectManager = projectRole === 'PROJECT_MANAGER'
  const isMember = projectRole === 'MEMBER'
  const projCanManage = isProjectManager || isTeamLead
  const canManage =
    systemHas('task.manage') ||
    systemHas('task.update.any') ||
    projCanManage ||
    priv

  return {
    canCreateTask: canManage,
    canUpdateTask: canManage,
    canUpdateStatus: isMember || canManage,
    canDeleteTask: systemHas('task.delete.any') || canManage,
    canAssignTask: systemHas('task.assign') || canManage,
    canManageMembers: systemHas('project.members.manage') || canManage,
    canDeleteProject: systemHas('project.delete') || priv,
  }
}

export function useSystemPermission(
  systemRole?: SystemRole,
): SystemPermissions {
  const sysPerms = useEffectivePermissions()

  // While `useRoles` is loading, fall back to the hardcoded
  // isPrivileged check so the first paint isn't visibly degraded.
  // Once roles arrive, each boolean becomes an exact permission check
  // against the tenant's live role record. `isLoading` surfaces the
  // in-flight state so page gates can defer — otherwise a user whose
  // custom role grants `user.list` would flash "no permission" before
  // the roles fetch resolves (the fallback only knows OWNER/ADMIN).
  if (!sysPerms) {
    const priv = isPrivilegedFallback(systemRole)
    return {
      canCreateProject: priv,
      canManageUsers: priv,
      canManageAdmins: systemRole === 'OWNER',
      canViewProgress: priv,
      canAssignTasks: priv,
      canApproveDayOffs: priv,
      isLoading: true,
    }
  }

  const has = (perm: string) => sysPerms.has(perm)
  return {
    canCreateProject: has('project.create'),
    canManageUsers:
      has('user.create') || has('user.invite') || has('user.delete'),
    canManageAdmins: has('user.role.manage'),
    canViewProgress: has('user.progress.view'),
    canAssignTasks: has('task.assign') || has('task.manage'),
    canApproveDayOffs: has('dayoff.approve'),
    isLoading: false,
  }
}

/**
 * Single-permission check for ad-hoc UI gates. Returns `null` while
 * loading so callers can decide whether to hide the affordance or
 * optimistically show it.
 *
 *   const canApprove = useHasPermission('dayoff.approve')
 *   if (canApprove === false) return null
 */
export function useHasPermission(permission: string): boolean | null {
  const sysPerms = useEffectivePermissions()
  if (!sysPerms) return null
  return sysPerms.has(permission)
}
