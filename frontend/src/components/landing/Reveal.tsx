'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

interface RevealProps {
  children: React.ReactNode
  /** Direction the element travels from. Default: `up`. */
  direction?: Direction
  /** ms to wait before starting the animation once in view. */
  delay?: number
  /** Set false to animate every time the element enters the viewport. */
  once?: boolean
  /** Pixels from the bottom at which to start the reveal. */
  rootMargin?: string
  className?: string
}

const hiddenTransforms: Record<Direction, string> = {
  up: 'translate3d(0, 24px, 0)',
  down: 'translate3d(0, -24px, 0)',
  left: 'translate3d(24px, 0, 0)',
  right: 'translate3d(-24px, 0, 0)',
  none: 'none',
}

/**
 * Wraps content so it fades + slides in the first time it scrolls into
 * view. Uses IntersectionObserver (cheap) + a CSS transition (handled by
 * the compositor, not JS). Respects `prefers-reduced-motion` by skipping
 * the transform entirely.
 *
 * Not a replacement for framer-motion — just the 90% case for landing
 * pages where we don't want a runtime dep.
 */
export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  once = true,
  rootMargin = '0px 0px -60px 0px',
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(m.matches)
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    m.addEventListener('change', listener)
    return () => m.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion) {
      setVisible(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once) io.unobserve(entry.target)
          } else if (!once) {
            setVisible(false)
          }
        }
      },
      { rootMargin, threshold: 0.05 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, rootMargin, prefersReducedMotion])

  const style: React.CSSProperties = {
    transition:
      'opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    transitionDelay: `${delay}ms`,
    willChange: 'opacity, transform',
    opacity: visible ? 1 : 0,
    transform: visible ? 'none' : hiddenTransforms[direction],
  }

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  )
}
