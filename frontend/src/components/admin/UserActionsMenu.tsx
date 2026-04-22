'use client'

import { MoreHorizontal, BarChart3, ShieldOff, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

interface UserActionsMenuProps {
  onViewProfile: () => void
  onViewProgress: () => void
  onDelete?: () => void
  /** OWNER-only — reset the target user's 2FA (disable their TOTP
   *  factor) so they can sign in with password alone after losing
   *  their authenticator. */
  onResetMfa?: () => void
}

export function UserActionsMenu({
  onViewProfile,
  onViewProgress,
  onDelete,
  onResetMfa,
}: UserActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="User actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onViewProfile}>
          <User className="h-4 w-4" />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onViewProgress}>
          <BarChart3 className="h-4 w-4" />
          View progress
        </DropdownMenuItem>
        {onResetMfa && (
          <DropdownMenuItem onClick={onResetMfa}>
            <ShieldOff className="h-4 w-4" />
            Reset 2FA
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className={cn(
                'text-destructive',
                '[&>svg]:!text-destructive focus:bg-destructive/10 focus:text-destructive'
              )}
            >
              <Trash2 className="h-4 w-4" />
              Delete user
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
