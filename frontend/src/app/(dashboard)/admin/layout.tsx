'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Spinner } from '@/components/ui/Spinner'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const isOwnerOrAdmin = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'

  useEffect(() => {
    if (!isLoading && !isOwnerOrAdmin) {
      router.replace('/dashboard')
    }
  }, [isLoading, isOwnerOrAdmin, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isOwnerOrAdmin) return null

  return <>{children}</>
}
