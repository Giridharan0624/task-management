import clsx from 'clsx'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const iconSizes = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
}

const textSizes = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-lg',
  xl: 'text-2xl',
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <div className={clsx(
        iconSizes[size],
        'relative rounded-xl flex items-center justify-center',
        'bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500',
        'shadow-md shadow-indigo-500/20',
      )}>
        {/*
          Logo concept: A "T" + "F" monogram fused into a forward-pointing arrow shape.
          The T crossbar extends right and angles down into an arrow,
          forming the F's horizontal strokes — symbolizing tasks flowing forward.
        */}
        <svg viewBox="0 0 32 32" fill="none" className="w-[62%] h-[62%]">
          {/* Vertical stem of T/F */}
          <path
            d="M10 7v18"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Top crossbar of T — extends into forward arrow */}
          <path
            d="M10 7h10l4 4"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Middle bar of F — shorter, also flows forward */}
          <path
            d="M10 16h8l3 3"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <span className={clsx(
          textSizes[size],
          'font-bold tracking-tight text-gray-900',
        )}>
          Task<span className="text-indigo-600">Flow</span>
        </span>
      )}
    </div>
  )
}
