import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const config = {
  sm: { icon: 28, text: 'text-[15px]', gap: 'gap-2' },
  md: { icon: 34, text: 'text-[17px]', gap: 'gap-2.5' },
  lg: { icon: 44, text: 'text-xl', gap: 'gap-3' },
  xl: { icon: 56, text: 'text-2xl', gap: 'gap-3.5' },
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const s = config[size]

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="TaskFlow"
        width={s.icon}
        height={s.icon}
        className="rounded-[22%] shadow-sm"
      />
      {showText && (
        <span
          className={cn(
            s.text,
            'font-extrabold tracking-tight select-none'
          )}
        >
          <span className="text-foreground">Task</span>
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Flow
          </span>
        </span>
      )}
    </div>
  )
}
