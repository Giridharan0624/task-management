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
 * `useHasPermission` returns null while `/orgs/current/roles` is in
 * flight. During that window we fall back to the legacy system-role
 * check so the first paint isn't degraded.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const canListUsers = useHasPermission('user.list')

  const legacyIsAdmin =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const allowed =
    canListUsers === null ? legacyIsAdmin : canListUsers

  useEffect(() => {
    if (isLoading) return
    if (!user) return // AuthProvider will redirect
    if (!allowed) router.replace('/dashboard')
  }, [isLoading, user, allowed, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}
