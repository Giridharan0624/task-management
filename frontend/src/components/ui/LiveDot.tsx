'use client'

import { cn } from '@/lib/utils'

interface LiveDotProps {
  /** Size preset. Defaults to `sm` which matches chip strips and inline row usage. */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Tailwind color class for the solid inner dot. Default: `bg-emerald-500` */
  color?: string
  /** Tailwind color class for the outer ping. Default: `bg-emerald-400` */
  pingColor?: string
  className?: string
  /** Hide the ping animation — useful for static "present but not live" states */
  static?: boolean
}

const SIZE_CLASSES: Record<NonNullable<LiveDotProps['size']>, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

/**
 * A consistent "live/online" indicator: a solid colored dot with an
 * animated ping ring around it. Defaults to emerald (online/working).
 * Use `static` to suppress the animation when the thing is present but
 * not actively happening (e.g. "signed in" vs "currently working").
 */
export function LiveDot({
  size = 'sm',
  color = 'bg-emerald-500',
  pingColor = 'bg-emerald-400',
  className,
  static: isStatic = false,
}: LiveDotProps) {
  const sizeClass = SIZE_CLASSES[size]
  return (
    <span
      className={cn('relative inline-flex shrink-0', sizeClass, className)}
      aria-hidden="true"
    >
      {!isStatic && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            pingColor
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          sizeClass,
          color
        )}
      />
    </span>
  )
}
