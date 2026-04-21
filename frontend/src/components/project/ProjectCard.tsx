'use client'

import { useRouter } from 'next/navigation'
import { Users, Clock } from 'lucide-react'
import type { Project } from '@/types/project'
import { getProjectColor } from '@/lib/utils/projectColor'
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

function getGradient(name: string): string {
  return getProjectColor(name)
}

const DOMAIN_PILL: Record<string, string> = {
  DEVELOPMENT: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
  DESIGNING: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  MANAGEMENT: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  RESEARCH: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
}

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

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => prefetchProject(project.projectId)}
      onFocus={() => prefetchProject(project.projectId)}
      className="group hover-lift relative flex cursor-pointer flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-border/80 hover:shadow-md"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${getGradient(project.name)}`}
          >
            <span className="text-sm font-bold text-white drop-shadow-sm">
              {project.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
              {project.name}
            </h3>
            {project.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {project.description}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground/60 italic">
                No description
              </p>
            )}
          </div>
        </div>
        <ProjectActionsMenu
          projectId={project.projectId}
          onDelete={
            canDeleteProject ? () => onDelete(project.projectId) : undefined
          }
        />
      </div>

      {/* Domain pill */}
      {domain && (
        <div className="mb-3">
          <span
            className={cn(
              'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              DOMAIN_PILL[domain] || 'bg-muted text-muted-foreground'
            )}
          >
            {domain.toLowerCase()}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {taskCount > 0 ? (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Progress</span>
            <span
              className={cn(
                'font-bold tabular-nums',
                completionPercent >= 100
                  ? 'text-emerald-600'
                  : completionPercent >= 50
                    ? 'text-primary'
                    : 'text-amber-600'
              )}
            >
              {completionPercent}%
            </span>
          </div>
          <Progress value={completionPercent} className="h-1.5" />
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
          <StatDot color="bg-amber-400" label={`${todoCount} todo`} />
          <StatDot color="bg-blue-500" label={`${inProgressCount} active`} />
          <StatDot color="bg-emerald-500" label={`${doneCount} done`} />
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-3 text-[11px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <RelativeTime value={lastActivity} />
        </span>
      </div>
      {creatorName && (
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          Created by {creatorName}
        </p>
      )}
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
