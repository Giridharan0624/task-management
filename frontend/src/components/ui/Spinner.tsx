import clsx from 'clsx'

export type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

const config: Record<SpinnerSize, { wrapper: string; icon: string; track: number }> = {
  sm: { wrapper: 'h-4 w-4', icon: '0', track: 2 },
  md: { wrapper: 'h-6 w-6', icon: '0', track: 2.5 },
  lg: { wrapper: 'h-12 w-12', icon: '14', track: 3 },
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const c = config[size]
  const showIcon = size === 'lg'

  return (
    <span
      className={clsx('inline-flex items-center justify-center relative', c.wrapper, className)}
      role="status"
      aria-label="Loading"
    >
      {/* Spinning arc */}
      <svg className="animate-spin absolute inset-0" viewBox="0 0 40 40" fill="none">
        {/* Background track */}
        <circle cx="20" cy="20" r="17" stroke="#e8e8ee" strokeWidth={c.track} />
        {/* Gradient arc */}
        <circle
          cx="20" cy="20" r="17"
          stroke="url(#spinnerGrad)"
          strokeWidth={c.track}
          strokeLinecap="round"
          strokeDasharray="80 107"
        />
        <defs>
          <linearGradient id="spinnerGrad" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>

      {/* Logo mark in center for lg size */}
      {showIcon && (
        <svg viewBox="0 0 32 32" fill="none" className="w-[14px] h-[14px] relative z-10">
          <path d="M10 7v18" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
          <path d="M10 7h10l4 4" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 16h8l3 3" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}
