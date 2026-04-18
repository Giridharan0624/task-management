'use client'

import Link from 'next/link'
import { MoreHorizontal, ExternalLink, Users, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

interface ProjectActionsMenuProps {
  projectId: string
  onDelete?: () => void
}

export function ProjectActionsMenu({
  projectId,
  onDelete,
}: ProjectActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Project actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem asChild>
          <Link href={`/projects/${projectId}`}>
            <ExternalLink className="h-4 w-4" />
            Open project
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/projects/${projectId}/members`}>
            <Users className="h-4 w-4" />
            Members
          </Link>
        </DropdownMenuItem>
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
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
