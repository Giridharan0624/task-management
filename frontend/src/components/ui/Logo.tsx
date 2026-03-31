import clsx from 'clsx'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const config = {
  sm: { icon: 'w-7 h-7', text: 'text-[15px]', gap: 'gap-2' },
  md: { icon: 'w-9 h-9', text: 'text-[17px]', gap: 'gap-2.5' },
  lg: { icon: 'w-11 h-11', text: 'text-xl', gap: 'gap-3' },
  xl: { icon: 'w-14 h-14', text: 'text-2xl', gap: 'gap-3.5' },
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const s = config[size]

  return (
    <div className={clsx('flex items-center', s.gap, className)}>
      {/* Icon mark */}
      <div className={clsx(
        s.icon,
        'relative rounded-[22%] flex items-center justify-center',
        'bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500',
        'shadow-lg shadow-indigo-500/25',
        'ring-1 ring-indigo-400/10',
      )}>
        <svg viewBox="0 0 32 32" fill="none" className="w-[58%] h-[58%]">
          {/* Vertical stem */}
          <path
            d="M10 7v18"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Top crossbar — extends left for T, right with arrow for F */}
          <path
            d="M4 7h16l4 4"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Middle bar → shorter flow arrow */}
          <path
            d="M10 16h8l3 3"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <span className={clsx(s.text, 'font-extrabold tracking-tight select-none')}>
          <span className="text-gray-900">Task</span>
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Flow</span>
        </span>
      )}
    </div>
  )
}
