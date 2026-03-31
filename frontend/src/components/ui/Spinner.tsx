import clsx from 'clsx'

export type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

const config: Record<SpinnerSize, { wrapper: string; dot: string; gap: string }> = {
  sm: { wrapper: 'h-4 w-4', dot: 'h-1 w-1', gap: 'gap-0.5' },
  md: { wrapper: 'h-6 w-6', dot: 'h-1.5 w-1.5', gap: 'gap-0.5' },
  lg: { wrapper: 'h-10 w-10', dot: 'h-2 w-2', gap: 'gap-1' },
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const c = config[size]

  return (
    <span
      className={clsx('inline-flex items-center justify-center', c.wrapper, c.gap, className)}
      role="status"
      aria-label="Loading"
    >
      <span className={clsx(c.dot, 'rounded-full bg-indigo-500 dark:bg-indigo-400 animate-bounce')} style={{ animationDelay: '0ms' }} />
      <span className={clsx(c.dot, 'rounded-full bg-indigo-500 dark:bg-indigo-400 animate-bounce')} style={{ animationDelay: '150ms' }} />
      <span className={clsx(c.dot, 'rounded-full bg-indigo-500 dark:bg-indigo-400 animate-bounce')} style={{ animationDelay: '300ms' }} />
    </span>
  )
}
