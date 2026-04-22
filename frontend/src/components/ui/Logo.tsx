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
  /** Render the wordmark in light colours for dark backgrounds. */
  onDark?: boolean
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
  onDark = false,
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
  // Product brand is always TaskFlow. The icon never changes per tenant —
  // the workspace name still renders as the subline so admins know which
  // workspace they're in, but the mark itself stays consistent across the
  // whole product (dashboard, auth, landing, legal, everywhere).
  const logoUrl = '/logo.png'
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
            <span className={onDark ? 'text-white' : 'text-foreground'}>
              {PRODUCT_HEAD}
            </span>
            <span
              className={cn(
                'bg-clip-text text-transparent',
                onDark
                  ? 'bg-gradient-to-r from-indigo-300 to-fuchsia-300'
                  : 'bg-gradient-to-r from-primary to-primary/70'
              )}
            >
              {PRODUCT_TAIL}
            </span>
          </span>
          {showSubline && (
            <span
              className={cn(
                s.sub,
                'font-semibold uppercase tracking-wider select-none -mt-0.5',
                onDark ? 'text-white/60' : 'text-muted-foreground'
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
