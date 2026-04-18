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

interface RoleDropdownProps {
  role: string
  onChange: (role: string) => void
  disabled?: boolean
  roles?: string[]
}

const ROLE_STYLES: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200',
  ADMIN: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
}

export function RoleDropdown({
  role,
  onChange,
  disabled,
  roles = ['ADMIN', 'MEMBER'],
}: RoleDropdownProps) {
  // OWNER role isn't editable from here.
  if (disabled || role === 'OWNER') {
    return <Badge className={ROLE_STYLES[role]}>{role}</Badge>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            ROLE_STYLES[role] || ROLE_STYLES.MEMBER
          )}
          aria-label={`Change role (currently ${role})`}
        >
          <span>{role}</span>
          <ChevronDown className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuRadioGroup value={role} onValueChange={onChange}>
          {roles.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {r}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ROLE_STYLES }
