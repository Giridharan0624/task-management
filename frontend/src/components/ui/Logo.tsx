'use client'

import { cn } from '@/lib/utils'
import { useTenant } from '@/lib/tenant/TenantProvider'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  /**
   * Force-hide the tenant-name subline. Use on public marketing pages
   * (landing, auth) where there's no workspace context yet, so the
   * TenantProvider's default-tenant fallback (NEUROSTACK) doesn't leak
   * into the header of what's really a generic TaskFlow page.
   */
  hideSubline?: boolean
  className?: string
}

const config = {
  sm: { icon: 28, text: 'text-[15px]', sub: 'text-[10px]', gap: 'gap-2' },
  md: { icon: 34, text: 'text-[17px]', sub: 'text-[11px]', gap: 'gap-2.5' },
  lg: { icon: 44, text: 'text-xl',     sub: 'text-xs',     gap: 'gap-3' },
  xl: { icon: 56, text: 'text-2xl',    sub: 'text-sm',     gap: 'gap-3.5' },
}

const PRODUCT_NAME = 'TaskFlow'
const PRODUCT_HEAD = 'Task'
const PRODUCT_TAIL = 'Flow'

export function Logo({
  size = 'md',
  showText = true,
  hideSubline = false,
  className,
}: LogoProps) {
  const s = config[size]
  // Product brand stays "TaskFlow" — that's the SaaS this user is on.
  // The tenant name renders as a secondary subline so admins know which
  // workspace they're in (especially useful when an account has access
  // to multiple workspaces). Falls back to no subline when we don't know
  // the tenant yet (public pages, pre-resolution).
  const tenant = useTenant()
  const orgName =
    tenant.summary?.displayName || tenant.current?.org?.name || ''
  // On public pages (hideSubline=true) we intentionally ignore any
  // tenant-provided logo so the default TaskFlow mark is shown instead
  // of whatever the fallback tenant happens to have configured.
  const logoUrl = hideSubline
    ? '/logo.png'
    : (tenant.summary?.logoUrl ?? '/logo.png')
  // Don't repeat the org name when the tenant is the default fallback
  // (no real tenant resolved yet) or when the org happens to be named
  // "TaskFlow" already.
  const showSubline =
    !hideSubline &&
    !!orgName &&
    orgName.toLowerCase() !== PRODUCT_NAME.toLowerCase()

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={orgName || PRODUCT_NAME}
        width={s.icon}
        height={s.icon}
        className="rounded-[22%] shadow-sm"
      />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              s.text,
              'font-extrabold tracking-tight select-none'
            )}
          >
            <span className="text-foreground">{PRODUCT_HEAD}</span>
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {PRODUCT_TAIL}
            </span>
          </span>
          {showSubline && (
            <span
              className={cn(
                s.sub,
                'font-semibold uppercase tracking-wider text-muted-foreground select-none -mt-0.5'
              )}
            >
              {orgName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
