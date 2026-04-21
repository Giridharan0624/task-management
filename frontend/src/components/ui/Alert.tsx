import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4',
  {
    variants: {
      variant: {
        default: 'bg-card text-foreground border-border [&>svg]:text-foreground',
        info: 'bg-blue-50/60 text-blue-900 border-blue-200/70 [&>svg]:text-blue-600 dark:bg-blue-500/10 dark:text-blue-100 dark:border-blue-500/30 dark:[&>svg]:text-blue-300',
        success:
          'bg-emerald-50/60 text-emerald-900 border-emerald-200/70 [&>svg]:text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-100 dark:border-emerald-500/30 dark:[&>svg]:text-emerald-300',
        warning:
          'bg-amber-50/60 text-amber-900 border-amber-200/70 [&>svg]:text-amber-600 dark:bg-amber-500/10 dark:text-amber-100 dark:border-amber-500/30 dark:[&>svg]:text-amber-300',
        destructive:
          'bg-destructive/5 text-destructive border-destructive/30 [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      'mb-1 font-semibold leading-none tracking-tight text-sm',
      className
    )}
    {...props}
  />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
