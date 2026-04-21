'use client'

import { WifiOff } from 'lucide-react'
import { useIsOffline } from '@/lib/hooks/useOnlineStatus'

export function OfflineBanner() {
  const offline = useIsOffline()
  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-amber-400/40 bg-amber-500/10 px-4 py-2 text-[12px] font-medium text-amber-900 dark:text-amber-200 animate-fade-in"
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>You&apos;re offline. Changes will sync when the connection is restored.</span>
    </div>
  )
}
