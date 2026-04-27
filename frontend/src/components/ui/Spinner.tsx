'use client'

import { useId } from 'react'

/**
 * Theme-aware loading spinner.
 *
 * A single tapered arc that rotates inside a faint static track. The
 * arc uses the active theme's `--color-primary` (via Tailwind's
 * `text-primary` → `currentColor`) so the spinner re-themes alongside
 * the rest of the app — no more hardcoded indigo+violet gradient that
 * clashed with Cypress, Velour, etc.
 *
 * Motion design:
 *   · the visible portion of the arc tapers from 30% → 100% opacity
 *     via a linear gradient, giving the rotation a "leading edge"
 *     instead of a uniform stripe
 *   · rounded line caps + a 130° arc length feel substantial without
 *     reading as "almost-full circle"
 *   · 0.9s spin period — fast enough to communicate progress, slow
 *     enough to not feel anxious
 *
 * The `lg` variant adds a counter-rotating inner arc at half speed
 * for layered depth on full-page loading screens. `sm` and `md`
 * keep just the single arc to stay lightweight inside buttons / rows.
 */

export type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

const sizeMap: Record<
  SpinnerSize,
  { box: string; stroke: number; period: string }
> = {
  sm: { box: 'h-4 w-4', stroke: 3, period: '0.85s' },
  md: { box: 'h-6 w-6', stroke: 2.6, period: '0.9s' },
  lg: { box: 'h-12 w-12', stroke: 2.2, period: '0.95s' },
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const { box, stroke, period } = sizeMap[size]
  // Unique gradient id per render instance — multiple spinners on the
  // same page (e.g. inline button + page-level) would otherwise share
  // a defs id and one would overwrite the other's gradient stops.
  //
  // Must be deterministic across SSR↔client or React's hydrator
  // detects the id mismatch and refuses to patch the tree (the
  // "tree hydrated but some attributes ... didn't match" error).
  // useId is the canonical fix — same value on server and client,
  // unique per render instance. Math.random was the prior approach
  // and produced a different id on each render.
  const reactId = useId()
  const gradId = `spin-grad-${size}-${reactId.replace(/:/g, '')}`

  return (
    <span
      className={`inline-flex items-center justify-center text-primary ${box} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
      >
        <defs>
          {/* Tapering gradient — leading edge is solid, trailing edge
              fades to ~30%. Creates the illusion of motion blur on the
              tail of the arc. */}
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1="4"
            y1="24"
            x2="44"
            y2="24"
          >
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
            <stop offset="60%" stopColor="currentColor" stopOpacity="0.7" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Static track — a faint full circle so the empty portion of
            the spin still has visual structure. Opacity is low enough
            to not compete with the spinning arc on either light or
            dark surfaces. */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeOpacity="0.12"
        />

        {/* Outer spinning arc — ~130° of circumference */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="46 80"
          className="origin-center animate-spin"
          style={{ animationDuration: period }}
        />

        {/* Inner counter-rotating arc — only on `lg` so page-level
            loading screens get a layered "two orbits" feel. Spins
            slower so the two motions don't sync up and read as one
            blur. The reverse rotation comes from `scale(-1, 1)` on
            the group, which mirrors the spin direction without
            needing a custom keyframe. */}
        {size === 'lg' && (
          <g style={{ transform: 'scale(-1, 1)', transformOrigin: 'center' }}>
            <circle
              cx="24"
              cy="24"
              r="11"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray="22 50"
              strokeOpacity="0.55"
              className="origin-center animate-spin"
              style={{ animationDuration: '1.5s' }}
            />
          </g>
        )}
      </svg>
    </span>
  )
}
