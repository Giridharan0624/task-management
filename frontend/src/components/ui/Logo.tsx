import clsx from 'clsx'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const config = {
  sm: { icon: 28, text: 'text-[15px]', gap: 'gap-2' },
  md: { icon: 36, text: 'text-[17px]', gap: 'gap-2.5' },
  lg: { icon: 44, text: 'text-xl', gap: 'gap-3' },
  xl: { icon: 56, text: 'text-2xl', gap: 'gap-3.5' },
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const s = config[size]

  return (
    <div className={clsx('flex items-center', s.gap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="TaskFlow"
        width={s.icon}
        height={s.icon}
        className="rounded-[22%]"
      />

      {showText && (
        <span className={clsx(s.text, 'font-extrabold tracking-tight select-none')}>
          <span className="text-gray-900 dark:text-white">Task</span>
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Flow</span>
        </span>
      )}
    </div>
  )
}
