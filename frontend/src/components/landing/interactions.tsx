'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────────────
 *  useReducedMotion — shared helper
 * ──────────────────────────────────────────────────────────────────── */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(m.matches)
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches)
    m.addEventListener('change', listener)
    return () => m.removeEventListener('change', listener)
  }, [])
  return reduced
}

/* ────────────────────────────────────────────────────────────────────
 *  MouseSpotlight — radial glow that follows the cursor
 * ──────────────────────────────────────────────────────────────────── */

interface MouseSpotlightProps {
  children: ReactNode
  className?: string
  /** Glow size in px. Default 420. */
  size?: number
  /** CSS color for the glow. Defaults to the primary brand color. */
  color?: string
}

/**
 * Wraps a section so a soft gradient follows the user's cursor inside the
 * wrapper. Writes to a CSS variable via `requestAnimationFrame` so the
 * render loop stays off the React tree. Respects `prefers-reduced-motion`
 * by leaving the gradient static at the center.
 */
export function MouseSpotlight({
  children,
  className,
  size = 420,
  color = 'rgba(var(--color-primary) / 0.22)',
}: MouseSpotlightProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return

    let raf = 0
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (raf) return
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${x}px`)
        el.style.setProperty('--my', `${y}px`)
        raf = 0
      })
    }
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      style={
        {
          '--mx': '50%',
          '--my': '30%',
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 transition-opacity duration-300"
        style={{
          background: `radial-gradient(${size}px circle at var(--mx) var(--my), ${color}, transparent 60%)`,
        }}
      />
      {children}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  TiltCard — cards that tilt slightly toward the cursor
 * ──────────────────────────────────────────────────────────────────── */

interface TiltCardProps {
  children: ReactNode
  className?: string
  /** Max rotation in degrees. Default 6. */
  maxTilt?: number
  /** Lift distance in px on hover. Default 4. */
  lift?: number
}

/**
 * Adds a subtle perspective tilt that follows the cursor's position inside
 * the card. Movement is GPU-composited (transform only), throttled via
 * `requestAnimationFrame`, and skipped when reduced-motion is on.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 6,
  lift = 4,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduced = useReducedMotion()

  const reset = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateZ(0)'
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return

    let raf = 0
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width - 0.5
      const relY = (e.clientY - rect.top) / rect.height - 0.5
      if (raf) return
      raf = requestAnimationFrame(() => {
        const rx = (-relY * maxTilt).toFixed(2)
        const ry = (relX * maxTilt).toFixed(2)
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${lift}px)`
        raf = 0
      })
    }
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      reset()
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [maxTilt, lift, reduced, reset])

  return (
    <div
      ref={ref}
      className={cn('transition-transform duration-200 ease-out will-change-transform', className)}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  TypewriterText — reveals characters when scrolled into view
 * ──────────────────────────────────────────────────────────────────── */

interface TypewriterTextProps {
  /** Lines to type. Typed sequentially with a short pause between. */
  lines: string[]
  /** ms per character. Default 28. */
  speed?: number
  /** ms pause between lines. Default 240. */
  linePause?: number
  className?: string
  /** Show blinking caret at the end while typing. */
  caret?: boolean
}

/**
 * Types each string character-by-character once the element scrolls in.
 * When reduced-motion is on, the full text renders instantly.
 */
export function TypewriterText({
  lines,
  speed = 28,
  linePause = 240,
  className,
  caret = true,
}: TypewriterTextProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [rendered, setRendered] = useState<string[]>([])
  const [active, setActive] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      setRendered([...lines])
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(true)
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lines, reduced])

  useEffect(() => {
    if (!active || reduced) return
    let cancelled = false
    let acc: string[] = []
    const run = async () => {
      for (let li = 0; li < lines.length; li++) {
        const full = lines[li]
        acc.push('')
        const idx = acc.length - 1
        for (let i = 0; i <= full.length; i++) {
          if (cancelled) return
          acc = acc.map((v, k) => (k === idx ? full.slice(0, i) : v))
          setRendered([...acc])
          await new Promise((r) => setTimeout(r, speed))
        }
        await new Promise((r) => setTimeout(r, linePause))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [active, lines, speed, linePause, reduced])

  return (
    <div ref={ref} className={cn('font-mono text-sm leading-relaxed', className)}>
      {rendered.map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {line}
          {caret && i === rendered.length - 1 && active && (
            <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-current align-middle animate-blink" />
          )}
        </p>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  ActivityWaveform — animated mini bar chart
 * ──────────────────────────────────────────────────────────────────── */

interface ActivityWaveformProps {
  /** Heights 0-1. If omitted, a pleasant pseudo-random pattern ships. */
  values?: number[]
  className?: string
  barClassName?: string
}

const DEFAULT_BARS = [
  0.25, 0.35, 0.42, 0.58, 0.7, 0.82, 0.9, 0.74, 0.62, 0.48,
  0.55, 0.66, 0.78, 0.88, 0.95, 0.86, 0.72, 0.58, 0.65, 0.78,
  0.88, 0.94, 0.82, 0.65, 0.5, 0.42, 0.38, 0.45,
]

/**
 * A row of animated vertical bars that "play in" on scroll — simulates the
 * activity tracker capturing keystroke/mouse events over a day.
 */
export function ActivityWaveform({
  values = DEFAULT_BARS,
  className,
  barClassName,
}: ActivityWaveformProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  return (
    <div
      ref={ref}
      className={cn('flex h-28 items-end justify-between gap-1', className)}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            'flex-1 rounded-t-sm bg-gradient-to-t from-primary/30 via-primary to-accent transition-[height] ease-out',
            barClassName
          )}
          style={{
            height: visible ? `${Math.max(8, v * 100)}%` : '4%',
            transitionDuration: `${700 + i * 30}ms`,
            transitionDelay: `${i * 18}ms`,
          }}
        />
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  ScreenshotStack — stacked frames that cycle to simulate capture
 * ──────────────────────────────────────────────────────────────────── */

interface ScreenshotStackProps {
  className?: string
}

/**
 * Three stacked pseudo-screenshot tiles that shuffle every 3 seconds,
 * demonstrating the periodic-capture feature. Pure CSS + a 3-step state
 * so it stays crisp and reduced-motion-safe.
 */
export function ScreenshotStack({ className }: ScreenshotStackProps) {
  const [step, setStep] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setStep((s) => (s + 1) % 3), 3000)
    return () => clearInterval(id)
  }, [reduced])

  return (
    <div className={cn('relative mx-auto aspect-[4/3] w-full max-w-[380px]', className)}>
      {[0, 1, 2].map((i) => {
        // Each tile's "place in stack" rotates with the step. Tile at
        // position 0 is front, 1 is middle, 2 is back.
        const pos = (i - step + 3) % 3
        const isFront = pos === 0
        return (
          <div
            key={i}
            aria-hidden
            className={cn(
              'absolute inset-0 origin-bottom rounded-2xl border border-border/70 bg-card shadow-elevated',
              'transition-all duration-700 ease-out'
            )}
            style={{
              transform: `translateY(${pos * 12}px) translateX(${pos * -8}px) scale(${1 - pos * 0.04}) rotate(${pos * -2}deg)`,
              opacity: 1 - pos * 0.15,
              zIndex: 10 - pos,
            }}
          >
            <div className="flex items-center gap-1 border-b border-border/60 bg-muted/30 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 font-mono text-[9px] text-muted-foreground">
                capture · {new Date(Date.now() - i * 7 * 60_000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="grid h-[calc(100%-24px)] grid-cols-6 gap-1.5 p-3">
              {/* Fake window chrome + content — just colored blocks suggestive
                  of an IDE / document window. */}
              {Array.from({ length: 18 }).map((_, k) => {
                const hue = (i * 60 + k * 17) % 360
                return (
                  <span
                    key={k}
                    className="rounded-sm"
                    style={{
                      backgroundColor: `hsl(${hue}, 65%, ${isFront ? 70 : 82}%)`,
                      opacity: isFront ? 0.8 : 0.45,
                    }}
                  />
                )
              })}
            </div>
            {isFront && (
              <div className="absolute -right-3 top-3 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Captured
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  useScrollY — scroll offset for parallax
 * ──────────────────────────────────────────────────────────────────── */

export function useScrollY(): number {
  const [y, setY] = useState(0)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        setY(window.scrollY)
        raf = 0
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return y
}
