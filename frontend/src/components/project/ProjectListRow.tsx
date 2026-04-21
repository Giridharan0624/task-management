'use client'

import { useRouter } from 'next/navigation'
import { Users, Clock } from 'lucide-react'
import type { Project } from '@/types/project'
import { getProjectColor } from '@/lib/utils/projectColor'
import { Progress } from '@/components/ui/Progress'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { usePrefetchProject } from '@/lib/hooks/usePrefetchProject'
import { ProjectActionsMenu } from './ProjectActionsMenu'
import { DOMAIN_PILL } from './ProjectCard'
import { cn } from '@/lib/utils'

interface ProjectListRowProps {
  project: Project
  canDeleteProject: boolean
  onDelete: (projectId: string) => void
}

export function ProjectListRow({
  project,
  canDeleteProject,
  onDelete,
}: ProjectListRowProps) {
  const router = useRouter()
  const prefetchProject = usePrefetchProject()
  const memberCount = project.memberCount ?? project.members?.length ?? 0
  const taskCount = project.taskCount ?? 0
  const completionPercent = project.completionPercent ?? 0
  const domain = (project.domain || 'DEVELOPMENT').toUpperCase()
  const lastActivity = project.updatedAt || project.createdAt

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, [role="menuitem"]')) return
    router.push(`/projects/${project.projectId}`)
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => prefetchProject(project.projectId)}
      onFocus={() => prefetchProject(project.projectId)}
      tabIndex={0}
      className={cn(
        'group grid cursor-pointer items-center gap-4 border-b border-border/60 px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none',
        'grid-cols-[minmax(0,1fr)_110px_140px_100px_40px]',
        'md:grid-cols-[minmax(0,1fr)_110px_160px_80px_100px_40px]'
      )}
    >
      {/* Name + description */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm ${getProjectColor(project.name)}`}
        >
          <span className="text-xs font-bold text-white">
            {project.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {project.name}
          </p>
          {project.description && (
            <p className="truncate text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
      </div>

      {/* Domain */}
      <div>
        <span
          className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            DOMAIN_PILL[domain] || 'bg-muted text-muted-foreground'
          )}
        >
          {domain.toLowerCase()}
        </span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {taskCount > 0 ? (
          <>
            <Progress value={completionPercent} className="h-1.5 w-20" />
            <span
              className={cn(
                'text-xs font-bold tabular-nums',
                completionPercent >= 100
                  ? 'text-emerald-600'
                  : completionPercent >= 50
                    ? 'text-primary'
                    : 'text-amber-600'
              )}
            >
              {completionPercent}%
            </span>
          </>
        ) : (
          <span className="text-xs italic text-muted-foreground/70">
            No tasks
          </span>
        )}
      </div>

      {/* Members */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>{memberCount}</span>
      </div>

      {/* Last activity (hidden on narrow) */}
      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
        <Clock className="h-3 w-3" />
        <RelativeTime value={lastActivity} className="truncate" />
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <ProjectActionsMenu
          projectId={project.projectId}
          onDelete={
            canDeleteProject ? () => onDelete(project.projectId) : undefined
          }
        />
      </div>
    </div>
  )
}
