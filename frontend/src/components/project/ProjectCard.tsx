'use client'

import { useRouter } from 'next/navigation'
import type { Project } from '@/types/project'
import { Button } from '@/components/ui/Button'

interface ProjectCardProps {
  project: Project
  canDeleteProject: boolean
  onDelete: (projectId: string) => void
  isDeleting?: boolean
}

export function ProjectCard({ project, canDeleteProject, onDelete, isDeleting }: ProjectCardProps) {
  const router = useRouter()

  const memberCount = project.members?.length ?? 0
  const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking delete button
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    router.push(`/projects/${project.projectId}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
          {project.name}
        </h3>
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
            aria-label={`Delete project ${project.name}`}
          >
            Delete
          </Button>
        )}
      </div>

      {project.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{project.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
        <span>Created {createdDate}</span>
      </div>
    </div>
  )
}
