'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type PageTransitionVariant =
  | 'rise'   // fade + subtle upward translate + micro scale (default)
  | 'fade'   // pure opacity, no movement
  | 'slide'  // horizontal sweep from the right
  | 'scale'  // blooms from 96% to 100%
  | 'blur'   // blur ramp + fade

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
  /** Which animation to play on each navigation. Defaults to "rise".
   *  All variants share the same reduced-motion fallback (instant). */
  variant?: PageTransitionVariant
}

const VARIANT_CLASS: Record<PageTransitionVariant, string> = {
  rise: 'page-enter-rise',
  fade: 'page-enter-fade',
  slide: 'page-enter-slide',
  scale: 'page-enter-scale',
  blur: 'page-enter-blur',
}

/**
 * Re-keys its children on pathname change so the browser replays the
 * selected CSS page-enter animation. No AnimatePresence, no portal —
 * just a key swap + a CSS animation. Reduced-motion users get instant
 * content because every variant is neutralised in the reduced-motion
 * block in globals.css.
 */
export function PageTransition({
  children,
  className,
  variant = 'rise',
}: PageTransitionProps) {
  const pathname = usePathname()
  const [renderKey, setRenderKey] = useState(pathname)

  useEffect(() => {
    setRenderKey(pathname)
  }, [pathname])

  return (
    <div key={renderKey} className={cn(VARIANT_CLASS[variant], className)}>
      {children}
    </div>
  )
}
