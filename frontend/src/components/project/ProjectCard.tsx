'use client'

import { useRouter } from 'next/navigation'
import type { Project } from '@/types/project'
import { Button } from '@/components/ui/Button'
import { getProjectColor } from '@/lib/utils/projectColor'

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

export function ProjectCard({ project, canDeleteProject, onDelete, isDeleting, creatorName }: ProjectCardProps) {
  const router = useRouter()

  const memberCount = project.memberCount ?? project.members?.length ?? 0
  const taskCount = project.taskCount ?? 0
  const doneCount = project.doneCount ?? 0
  const inProgressCount = project.inProgressCount ?? 0
  const todoCount = taskCount - doneCount - inProgressCount
  const completionPercent = project.completionPercent ?? 0

  const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    router.push(`/projects/${project.projectId}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200 hover-lift"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${getGradient(project.name)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <span className="text-white font-bold text-sm drop-shadow-sm">{project.name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        {canDeleteProject && (
          <Button
            variant="danger"
            size="sm"
            loading={isDeleting}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(project.projectId)
            }}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Delete
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {taskCount > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500 font-medium">Progress</span>
            <span className="font-bold text-gray-700">{completionPercent}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionPercent >= 100 ? 'bg-emerald-500' : completionPercent >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(completionPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Task stats */}
      <div className="flex items-center gap-3 mb-3">
        {taskCount > 0 ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              <span className="text-[11px] font-medium text-gray-500">{todoCount} todo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="text-[11px] font-medium text-gray-500">{inProgressCount} active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-gray-500">{doneCount} done</span>
            </div>
          </>
        ) : (
          <span className="text-xs text-gray-400 italic">No tasks yet</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        </div>
        <span>{creatorName ? `${creatorName} · ` : ''}{createdDate}</span>
      </div>
    </div>
  )
}
