'use client'

/**
 * Left-nav for the unified /settings shell. Pre-Session-9 the various
 * settings surfaces were scattered: tabs inside /settings/organization
 * for some (Branding, Features, Locale, Leave types), separate top-level
 * routes for others (Roles, Pipelines, Plan, Audit, Webhooks, Transfer,
 * Delete). Admins couldn't predict whether something lived inside a tab
 * or behind a link card. This nav unifies them — every settings surface
 * is reachable from a single sticky left-rail.
 *
 * Permission gating: each entry declares the backend permission key it
 * requires. The nav reads `useEffectivePermissions()` and hides items
 * the caller can't act on. While roles are loading we fall back to the
 * legacy OWNER-only check so non-OWNERs don't briefly see admin items.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  ClipboardList,
  KanbanSquare,
  Key,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useEffectivePermissions } from '@/lib/hooks/usePermission'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  description?: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  /** Backend permission required to interact with this surface. Items
   *  without one are visible to any authenticated caller. */
  requiredPermission?: string
  /** Whether this item should render under the "Danger" group. The
   *  visual treatment differs (muted by default, destructive on hover)
   *  to make irreversible actions less likely to be clicked by reflex. */
  danger?: boolean
}

const ITEMS: NavItem[] = [
  {
    href: '/settings/organization',
    label: 'General',
    description: 'Branding, terminology, locale',
    icon: Palette,
    // Gated on settings.edit (not settings.view) because the page itself
    // redirects non-OWNERs back to /dashboard. Surface the entry only to
    // callers that can actually save changes.
    requiredPermission: 'settings.edit',
  },
  {
    href: '/settings/roles',
    label: 'Roles & permissions',
    description: 'Define who can do what',
    icon: ShieldCheck,
    requiredPermission: 'role.manage',
  },
  {
    href: '/settings/pipelines',
    label: 'Task pipelines',
    description: 'Custom workflows + colors',
    icon: KanbanSquare,
    requiredPermission: 'settings.edit',
  },
  {
    href: '/settings/plan',
    label: 'Plan & usage',
    description: 'Seats, projects, retention',
    icon: Sparkles,
    requiredPermission: 'billing.view',
  },
  {
    href: '/settings/audit',
    label: 'Audit log',
    description: 'Who changed what, when',
    icon: ClipboardList,
    // Audit page redirects non-OWNERs; gate matches that.
    requiredPermission: 'settings.edit',
  },
  {
    href: '/settings/webhooks',
    label: 'Webhooks',
    description: 'HMAC-signed event delivery',
    icon: Webhook,
    requiredPermission: 'settings.edit',
  },
  {
    href: '/settings/transfer-ownership',
    label: 'Transfer ownership',
    description: 'Hand off OWNER',
    icon: Key,
    danger: true,
  },
  {
    href: '/settings/delete-workspace',
    label: 'Delete workspace',
    description: 'Schedule permanent deletion',
    icon: Trash2,
    danger: true,
  },
]

export function SettingsNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const effectivePermissions = useEffectivePermissions()
  const legacyIsOwner = user?.systemRole === 'OWNER'

  // Transfer-ownership and delete-workspace are OWNER-only, gated at
  // the route level by their own page guards. Surface them here for
  // OWNER only so non-OWNERs don't see entries they'd just bounce off.
  // Other items use the per-permission filter below.
  const visible = ITEMS.filter((item) => {
    if (item.danger) return legacyIsOwner
    if (!item.requiredPermission) return true
    if (effectivePermissions === null) {
      // Roles fetch in flight — fall back to legacy-OWNER-only so
      // first paint doesn't flash admin items to a regular member.
      return legacyIsOwner
    }
    return effectivePermissions.has(item.requiredPermission)
  })

  const dangerItems = visible.filter((i) => i.danger)
  const normalItems = visible.filter((i) => !i.danger)

  return (
    <aside
      aria-label="Settings navigation"
      className="sticky top-4 flex w-full max-w-[260px] flex-col gap-1 self-start"
    >
      <div className="mb-2 flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <SettingsIcon className="h-3.5 w-3.5" />
        Settings
      </div>

      {normalItems.map((item) => (
        <SettingsNavLink
          key={item.href}
          item={item}
          active={isActive(pathname, item.href)}
        />
      ))}

      {dangerItems.length > 0 && (
        <>
          <div className="mt-4 mb-1 flex items-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-destructive/70">
            <AlertTriangle className="h-3 w-3" />
            Danger zone
          </div>
          {dangerItems.map((item) => (
            <SettingsNavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </>
      )}
    </aside>
  )
}

function SettingsNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-start gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all',
        active
          ? item.danger
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary'
          : item.danger
            ? 'text-muted-foreground hover:bg-destructive/5 hover:text-destructive'
            : 'text-foreground/85 hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 transition-colors',
          active && !item.danger ? 'text-primary' : '',
        )}
        strokeWidth={active ? 2.2 : 1.7}
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold leading-tight">{item.label}</span>
        {item.description && (
          <span className="text-[11px] font-normal leading-tight text-muted-foreground">
            {item.description}
          </span>
        )}
      </span>
    </Link>
  )
}

/** Active when the pathname matches the item exactly OR when it matches
 *  a deeper nested route under the item's prefix. The `/settings` index
 *  isn't its own item, so the General entry catches it via the equality
 *  check on the canonical href. */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (pathname === href) return true
  return pathname.startsWith(href + '/')
}
