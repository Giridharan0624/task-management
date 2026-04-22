'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  /** ms to reach the target. Default 900ms — short enough not to feel slow. */
  duration?: number
  /** Decimal places in the output. Default 0. */
  decimals?: number
  /** Prefix (e.g. "$") and suffix (e.g. "%") kept outside the tween. */
  prefix?: string
  suffix?: string
  className?: string
  /** Disable thousands separators. Default false. */
  plain?: boolean
}

/**
 * Tweens a number from its previous value to `value`. The first render
 * animates from 0; subsequent value changes animate from the prior
 * value. Respects `prefers-reduced-motion` by snapping to the final
 * value with a short fade-in instead.
 */
export function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  prefix,
  suffix,
  className,
  plain = false,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || !Number.isFinite(value)) {
      setDisplay(Number.isFinite(value) ? value : 0)
      fromRef.current = Number.isFinite(value) ? value : 0
      return
    }

    const from = fromRef.current
    const to = value
    if (from === to) {
      setDisplay(to)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        setDisplay(to)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, duration])

  const formatted = plain
    ? display.toFixed(decimals)
    : display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
