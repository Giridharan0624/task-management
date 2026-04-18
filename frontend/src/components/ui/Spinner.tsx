export type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

const sizeMap: Record<SpinnerSize, { box: string; stroke: number }> = {
  sm: { box: 'h-4 w-4', stroke: 3 },
  md: { box: 'h-6 w-6', stroke: 2.8 },
  lg: { box: 'h-12 w-12', stroke: 2.4 },
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const { box, stroke } = sizeMap[size]

  return (
    <span className={`inline-flex items-center justify-center ${box} ${className}`} role="status" aria-label="Loading">
      <svg className="w-full h-full" viewBox="0 0 48 48" fill="none">
        {/* Background track */}
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth={stroke} className="text-gray-200 dark:text-foreground/85" />

        {/* Spinning gradient arc */}
        <defs>
          <linearGradient id={`spin-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle
          cx="24" cy="24" r="20"
          stroke={`url(#spin-grad-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="80 126"
          className="origin-center animate-spin"
          style={{ animationDuration: '1s' }}
        />

        {/* TF logo mark — only for lg, centered in the circle */}
        {size === 'lg' && (
          <g>
            {/* T — vertical stem */}
            <path d="M22 16v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-indigo-600 dark:text-indigo-400" />
            {/* T — top crossbar */}
            <path d="M16 16h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-indigo-600 dark:text-indigo-400" />
            {/* F — middle bar */}
            <path d="M22 24h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-violet-500 dark:text-violet-400" />
          </g>
        )}
      </svg>
    </span>
  )
}
