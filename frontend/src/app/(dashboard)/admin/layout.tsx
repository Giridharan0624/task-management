'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useHasPermission } from '@/lib/hooks/usePermission'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Guard for the `/admin/*` subtree. Gates on `user.list` — the
 * minimum permission needed to render anything useful under admin/.
 * Non-admins (and admins who had this permission revoked by the
 * OWNER in /settings/roles) get redirected to /dashboard.
 *
 * Loading strategy:
 *   - If the user's `systemRole` is one of the three built-in tiers
 *     (OWNER/ADMIN/MEMBER), we can decide immediately from the
 *     hardcoded privileged check — no need to wait for roles.
 *   - If it's a custom role, we defer the redirect decision until
 *     the roles fetch resolves. Without this, a user whose custom
 *     role grants `user.list` gets bounced to /dashboard before the
 *     permission check has a chance to confirm their access.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const canListUsers = useHasPermission('user.list')

  const systemRole = user?.systemRole || ''
  const isBuiltinTier =
    systemRole === 'OWNER' || systemRole === 'ADMIN' || systemRole === 'MEMBER'
  const legacyIsAdmin = systemRole === 'OWNER' || systemRole === 'ADMIN'

  // Permission state: true / false / 'pending'. We only treat it as
  // 'pending' for custom role_ids — built-in tiers resolve correctly
  // from the fallback so there's no reason to delay their render.
  const permissionState: true | false | 'pending' =
    canListUsers !== null
      ? canListUsers
      : isBuiltinTier
        ? legacyIsAdmin
        : 'pending'

  useEffect(() => {
    if (isLoading) return
    if (!user) return // AuthProvider will redirect
    if (permissionState === 'pending') return // wait for roles to load
    if (!permissionState) router.replace('/dashboard')
  }, [isLoading, user, permissionState, router])

  if (isLoading || permissionState === 'pending') {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!permissionState) return null

  return <>{children}</>
}
