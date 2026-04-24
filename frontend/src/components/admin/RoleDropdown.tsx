'use client'

import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

interface RoleOption {
  roleId: string
  name: string
}

interface RoleDropdownProps {
  role: string
  onChange: (role: string) => void
  disabled?: boolean
  /** Roles offered in the dropdown. Each entry's `roleId` is what gets
   *  sent to the backend; `name` is the human-readable label from the
   *  tenant's role record. Defaults to the three built-in tiers
   *  (ADMIN/MEMBER — OWNER is never selectable here) so callers that
   *  haven't been updated to feed live roles still work. */
  roles?: RoleOption[]
}

// Palette for the three built-in tiers. Custom roles fall back to a
// stable hashed color so two users with the same tenant-defined role
// always get the same badge color, but different custom roles are
// visually distinguishable.
const BUILTIN_STYLES: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200',
  ADMIN: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
}

const CUSTOM_PALETTE: string[] = [
  'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
  'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200',
  'bg-pink-100 text-pink-800 ring-1 ring-inset ring-pink-200',
  'bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-200',
  'bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-200',
]

/** Deterministic color pick for a custom role_id. Same role_id → same
 *  palette slot, so the badge color is stable across a session. djb2
 *  hash: small, cheap, and good enough for a ~6-slot distribution. */
function hashRoleId(roleId: string): number {
  let h = 5381
  for (let i = 0; i < roleId.length; i++) {
    h = ((h << 5) + h + roleId.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function styleForRole(roleId: string): string {
  const upper = (roleId || '').toUpperCase()
  if (BUILTIN_STYLES[upper]) return BUILTIN_STYLES[upper]
  return CUSTOM_PALETTE[hashRoleId(roleId || '') % CUSTOM_PALETTE.length]
}

const DEFAULT_ROLES: RoleOption[] = [
  { roleId: 'ADMIN', name: 'Admin' },
  { roleId: 'MEMBER', name: 'Member' },
]

export function RoleDropdown({
  role,
  onChange,
  disabled,
  roles = DEFAULT_ROLES,
}: RoleDropdownProps) {
  // Show the role's human name when available; fall back to the raw id
  // for users whose role record was deleted while still assigned.
  const matched = roles.find(
    (r) => r.roleId.toLowerCase() === (role || '').toLowerCase(),
  )
  const label = (matched?.name || role || '').trim()
  const style = styleForRole(role)

  // OWNER role isn't editable from here. Keep it as a read-only badge.
  if (disabled || (role || '').toUpperCase() === 'OWNER') {
    return <Badge className={style}>{label}</Badge>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            style,
          )}
          aria-label={`Change role (currently ${label})`}
        >
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={role} onValueChange={onChange}>
          {roles.map((r) => (
            <DropdownMenuRadioItem key={r.roleId} value={r.roleId}>
              {r.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Compat shim — the admin/users page still reads this in the bio
// modal for its badge color. Re-export the style function so consumers
// that want a role-keyed CSS class can get one without importing the
// builtin map directly.
export const ROLE_STYLES = new Proxy({} as Record<string, string>, {
  get: (_, roleId: string) => styleForRole(roleId),
})
