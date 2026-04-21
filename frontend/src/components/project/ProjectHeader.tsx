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
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { getProjectColor } from '@/lib/utils/projectColor'
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

const DOMAIN_PILL: Record<string, string> = {
  DEVELOPMENT: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  DESIGNING: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  MANAGEMENT: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  RESEARCH: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
}

/** Gradient used for the accent strip at the top of the header. */
const DOMAIN_ACCENT: Record<string, string> = {
  DEVELOPMENT: 'from-indigo-500 via-blue-500 to-purple-500',
  DESIGNING: 'from-violet-500 via-fuchsia-500 to-pink-500',
  MANAGEMENT: 'from-amber-500 via-orange-500 to-red-500',
  RESEARCH: 'from-teal-500 via-cyan-500 to-sky-500',
}

const HEALTH_STYLES: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  COMPLETED: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Completed',
  },
  ON_TRACK: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'On track',
  },
  AT_RISK: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'At risk',
  },
  BEHIND: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
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
  const accent = DOMAIN_ACCENT[domain] ?? DOMAIN_ACCENT.DEVELOPMENT

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
    <Card className="relative overflow-hidden p-0">
      {/* Domain accent strip */}
      <div
        className={cn(
          'h-[3px] w-full bg-gradient-to-r',
          accent
        )}
        aria-hidden="true"
      />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md',
                getProjectColor(project.name)
              )}
            >
              <span className="text-xl font-bold text-white drop-shadow">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                  {project.name}
                </h1>
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    DOMAIN_PILL[domain] || 'bg-muted text-muted-foreground'
                  )}
                >
                  {DOMAIN_LABELS[domain as TaskDomain] || domain.toLowerCase()}
                </span>
                {hc && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold',
                      hc.bg,
                      hc.text
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', hc.dot)} />
                    {hc.label}
                  </span>
                )}
              </div>
              {project.description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              ) : (
                <p className="mt-1 text-sm italic text-muted-foreground/60">
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
          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overall project progress
              </span>
              <span
                className={cn(
                  'text-sm font-bold tabular-nums',
                  completionColor
                )}
              >
                {completionPercent}%
              </span>
            </div>
            <Progress value={completionPercent} className="h-1.5 w-full" />
          </div>
        )}
      </div>
    </Card>
  )
}
