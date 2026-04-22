'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/**
 * Re-keys its children on pathname change so the browser replays the
 * CSS `page-enter` animation. No AnimatePresence, no portal — just a
 * key swap + a CSS animation. Reduced-motion users get instant content
 * because `.page-enter` is neutralised in the reduced-motion block.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()
  const [renderKey, setRenderKey] = useState(pathname)

  useEffect(() => {
    setRenderKey(pathname)
  }, [pathname])

  return (
    <div key={renderKey} className={cn('page-enter', className)}>
      {children}
    </div>
  )
}
