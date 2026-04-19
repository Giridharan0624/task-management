'use client'

import { useEffect, useRef, useState } from 'react'

interface UseCountUpOptions {
  /** Duration of the animation in ms. Default: 800. */
  duration?: number
  /** Decimal places to render. Default: 0. */
  decimals?: number
  /** Disable animation entirely (respects reduced-motion / tests). */
  disabled?: boolean
}

/** easeOutCubic — punchy at start, settles gently at end */
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Animates a numeric value from 0 → `value` (or from previous value → new
 * value on subsequent changes). Returns the current animated number.
 * Respects `prefers-reduced-motion`.
 */
export function useCountUp(value: number, options: UseCountUpOptions = {}) {
  const { duration = 800, decimals = 0, disabled = false } = options
  const [current, setCurrent] = useState<number>(value)
  const rafRef = useRef<number | null>(null)
  const lastValueRef = useRef<number>(value)

  useEffect(() => {
    if (disabled) {
      setCurrent(value)
      return
    }

    // Respect user reduced-motion preference
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      if (mq.matches) {
        setCurrent(value)
        lastValueRef.current = value
        return
      }
    }

    const start = lastValueRef.current
    const delta = value - start
    if (delta === 0) {
      setCurrent(value)
      return
    }

    const startTime = performance.now()
    const multiplier = Math.pow(10, decimals)

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const raw = start + delta * eased
      const rounded = Math.round(raw * multiplier) / multiplier
      setCurrent(rounded)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        lastValueRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration, decimals, disabled])

  return current
}
