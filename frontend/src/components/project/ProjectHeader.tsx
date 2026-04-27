'use client'

import { MoreHorizontal, Pencil, Trash2, Calendar, RefreshCw, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Progress } from '@/components/ui/Progress'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { DOMAIN_LABELS, type TaskDomain } from '@/types/task'
import type { Project } from '@/types/project'
import type { ProjectStatus } from '@/lib/api/projectApi'
import { cn } from '@/lib/utils'

interface ProjectHeaderProps {
  project: Project
  status?: ProjectStatus | null
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  creatorName?: string
  completionPercent: number
  totalTasks: number
}

// Domain identity is carried by a vertical accent rule on the left of
// the title block (Bloomberg ticker / Linear project-icon convention).
// Same color is reused for the small dot beside the domain label below.
const DOMAIN_RULE: Record<string, string> = {
  DEVELOPMENT: 'bg-indigo-500',
  DESIGNING: 'bg-violet-500',
  MANAGEMENT: 'bg-amber-500',
  RESEARCH: 'bg-teal-500',
}

const HEALTH_STYLES: Record<
  string,
  { text: string; dot: string; label: string }
> = {
  COMPLETED: {
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Completed',
  },
  ON_TRACK: {
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'On track',
  },
  AT_RISK: {
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'At risk',
  },
  BEHIND: {
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    label: 'Behind',
  },
}


export function ProjectHeader({
  project,
  status,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  creatorName,
  completionPercent,
  totalTasks,
}: ProjectHeaderProps) {
  const domain = (project.domain || 'DEVELOPMENT').toUpperCase()
  const health = status?.health
  const hc = health ? HEALTH_STYLES[health] ?? HEALTH_STYLES.ON_TRACK : null
  const domainColor = DOMAIN_RULE[domain] ?? DOMAIN_RULE.DEVELOPMENT

  const visibleMembers = (project.members ?? []).slice(0, 4)
  const extraMembers = Math.max(0, (project.members?.length ?? 0) - visibleMembers.length)

  const completionColor =
    completionPercent >= 100
      ? 'text-emerald-600'
      : completionPercent >= 50
        ? 'text-primary'
        : completionPercent > 0
          ? 'text-amber-600'
          : 'text-muted-foreground'

  return (
    <div className="border-b border-border/60 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-stretch gap-4">
          {/* Domain accent: a thin vertical rule keyed to category. Picks
              up the same color as the dot beside the domain label below
              so identity reads in one glance. */}
          <span
            aria-hidden
            className={cn('w-[3px] shrink-0 rounded-full', domainColor)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight text-foreground">
                {project.name}
              </h1>
              <span className="inline-flex items-baseline gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <span
                  className={cn(
                    'h-1.5 w-1.5 translate-y-[2px] self-center rounded-full',
                    domainColor,
                  )}
                />
                {DOMAIN_LABELS[domain as TaskDomain] || domain.toLowerCase()}
              </span>
              {hc && (
                <span
                  className={cn(
                    'inline-flex items-baseline gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em]',
                    hc.text,
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 translate-y-[2px] self-center rounded-full',
                      hc.dot,
                    )}
                  />
                  {hc.label}
                </span>
              )}
            </div>
            {project.description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            ) : (
              <p className="mt-1.5 text-sm italic text-muted-foreground/60">
                No description
              </p>
            )}

              {/* Metadata row — created / updated / creator + member avatars */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Created <RelativeTime value={project.createdAt} />
                </span>
                {project.updatedAt && project.updatedAt !== project.createdAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3" />
                    Updated <RelativeTime value={project.updatedAt} />
                  </span>
                )}
                {creatorName && (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Created by{' '}
                    <span className="font-medium text-foreground/80">
                      {creatorName}
                    </span>
                  </span>
                )}
                {visibleMembers.length > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <span className="flex items-center -space-x-1.5">
                      {visibleMembers.map((m) => (
                        <div
                          key={m.userId}
                          className="ring-2 ring-card rounded-full"
                        >
                          <Avatar
                            url={m.user?.avatarUrl}
                            name={m.user?.name || m.user?.email || m.userId}
                            size="sm"
                          />
                        </div>
                      ))}
                      {extraMembers > 0 && (
                        <div
                          className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2 ring-card"
                          aria-label={`${extraMembers} more members`}
                        >
                          +{extraMembers}
                        </div>
                      )}
                    </span>
                    <span className="text-[11px]">
                      {project.members?.length} member
                      {project.members?.length !== 1 ? 's' : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  aria-label="Project actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {canEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                    Edit project
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    {canEdit && <DropdownMenuSeparator />}
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
          )}
        </div>

      {/* Overall project progress — a single dedicated row, clearly labeled */}
      {totalTasks > 0 && (
        <div className="mt-5 border-t border-border/40 pt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Overall project progress
            </span>
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                completionColor
              )}
            >
              {completionPercent}%
            </span>
          </div>
          <Progress value={completionPercent} className="h-1 w-full" />
        </div>
      )}
    </div>
  )
}
