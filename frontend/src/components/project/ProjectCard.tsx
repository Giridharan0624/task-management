'use client'

import { useRouter } from 'next/navigation'
import { Users, Clock } from 'lucide-react'
import type { Project } from '@/types/project'
import { Progress } from '@/components/ui/Progress'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { usePrefetchProject } from '@/lib/hooks/usePrefetchProject'
import { ProjectActionsMenu } from './ProjectActionsMenu'
import { cn } from '@/lib/utils'

interface ProjectCardProps {
  project: Project
  canDeleteProject: boolean
  onDelete: (projectId: string) => void
  isDeleting?: boolean
  creatorName?: string
}

// Domain identity → vertical accent color rule, matching the
// ProjectHeader convention. No more pill chips with bg+ring at full
// saturation; the rule + small dot+text label below carry the same
// signal in much less ink.
const DOMAIN_RULE: Record<string, string> = {
  DEVELOPMENT: 'bg-indigo-500',
  DESIGNING: 'bg-violet-500',
  MANAGEMENT: 'bg-amber-500',
  RESEARCH: 'bg-teal-500',
}

const DOMAIN_PILL: Record<string, string> = DOMAIN_RULE

export function ProjectCard({
  project,
  canDeleteProject,
  onDelete,
  creatorName,
}: ProjectCardProps) {
  const router = useRouter()
  const prefetchProject = usePrefetchProject()

  const memberCount = project.memberCount ?? project.members?.length ?? 0
  const taskCount = project.taskCount ?? 0
  const doneCount = project.doneCount ?? 0
  const inProgressCount = project.inProgressCount ?? 0
  const todoCount = taskCount - doneCount - inProgressCount
  const completionPercent = project.completionPercent ?? 0
  const lastActivity = project.updatedAt || project.createdAt
  const domain = (project.domain || 'DEVELOPMENT').toUpperCase()

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Don't navigate if click happened on an interactive child (button, link, etc.)
    if (target.closest('button, a, [role="menuitem"]')) return
    router.push(`/projects/${project.projectId}`)
  }

  const domainColor = DOMAIN_RULE[domain] ?? DOMAIN_RULE.DEVELOPMENT

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => prefetchProject(project.projectId)}
      onFocus={() => prefetchProject(project.projectId)}
      className="group relative flex cursor-pointer items-stretch gap-4 rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-foreground/30 hover:bg-muted/20"
    >
      {/* Domain accent rule — matches ProjectHeader convention */}
      <span
        aria-hidden
        className={cn('w-[3px] shrink-0 rounded-full', domainColor)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-medium text-foreground">
              {project.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-2">
              {domain && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <span className={cn('h-1.5 w-1.5 rounded-full', domainColor)} />
                  {domain.toLowerCase()}
                </span>
              )}
            </div>
            {project.description ? (
              <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
                {project.description}
              </p>
            ) : (
              <p className="mt-1.5 text-xs italic text-muted-foreground/60">
                No description
              </p>
            )}
          </div>
          <ProjectActionsMenu
            projectId={project.projectId}
            onDelete={
              canDeleteProject ? () => onDelete(project.projectId) : undefined
            }
          />
        </div>

        {/* Progress bar */}
        {taskCount > 0 ? (
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Progress
              </span>
              <span
                className={cn(
                  'text-xs font-medium tabular-nums',
                  completionPercent >= 100
                    ? 'text-emerald-700'
                    : 'text-foreground',
                )}
              >
                {completionPercent}%
              </span>
            </div>
            <Progress value={completionPercent} className="h-1" />
          </div>
        ) : (
          <div className="mb-3">
            <span className="text-xs italic text-muted-foreground/70">
              No tasks yet
            </span>
          </div>
        )}

        {/* Task stats */}
        {taskCount > 0 && (
          <div className="mb-3 flex items-center gap-3">
            <StatDot color="bg-amber-500" label={`${todoCount} todo`} />
            <StatDot color="bg-sky-500" label={`${inProgressCount} active`} />
            <StatDot color="bg-emerald-500" label={`${doneCount} done`} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3" strokeWidth={1.8} />
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            <RelativeTime value={lastActivity} />
          </span>
        </div>
        {creatorName && (
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            Created by {creatorName}
          </p>
        )}
      </div>
    </div>
  )
}

function StatDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export { DOMAIN_PILL }
