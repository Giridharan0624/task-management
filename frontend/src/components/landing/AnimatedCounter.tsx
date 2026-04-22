'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedCounterProps {
  to: number
  /** ms — total run duration. */
  duration?: number
  /** Optional suffix appended to the number (e.g. "+", "%"). */
  suffix?: string
  /** Optional prefix ("$"). */
  prefix?: string
  /** Split digits into comma groups (default true for numbers ≥ 1000). */
  separator?: boolean
  className?: string
}

/**
 * Counts up from 0 to `to` using requestAnimationFrame once the component
 * scrolls into view. Uses an easeOutCubic curve so the number "settles"
 * rather than slamming into its final value. Respects reduced-motion.
 */
export function AnimatedCounter({
  to,
  duration = 1600,
  suffix = '',
  prefix = '',
  separator,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setValue(to)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            io.unobserve(entry.target)
            const t0 = performance.now()
            const tick = (now: number) => {
              const p = Math.min(1, (now - t0) / duration)
              // easeOutCubic — soft stop without overshoot
              const eased = 1 - Math.pow(1 - p, 3)
              setValue(to * eased)
              if (p < 1) requestAnimationFrame(tick)
              else setValue(to)
            }
            requestAnimationFrame(tick)
          }
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [to, duration])

  const rounded = Math.round(value)
  const useSep = separator ?? rounded >= 1000
  const formatted = useSep ? rounded.toLocaleString() : String(rounded)

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
