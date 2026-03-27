'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useProjects, useDeleteProject } from '@/lib/hooks/useProjects'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { ProjectCard } from './ProjectCard'
import { CreateProjectModal } from './CreateProjectModal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function ProjectList() {
  const { user } = useAuth()
  const systemPerms = useSystemPermission(user?.systemRole)
  const { data: projects, isLoading, error } = useProjects()
  const deleteProject = useDeleteProject()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return
    setDeletingId(projectId)
    try {
      await deleteProject.mutateAsync(projectId)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        Failed to load projects. Please try again.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">My Projects</h2>
        {systemPerms.canCreateProject && (
          <Button onClick={() => setShowCreateModal(true)}>Create Project</Button>
        )}
      </div>

      {!projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 gap-4">
          <svg
            className="h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-500">No projects yet.</p>
          {systemPerms.canCreateProject && (
            <Button onClick={() => setShowCreateModal(true)}>Create your first project</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.projectId}
              project={project}
              canDeleteProject={systemPerms.canCreateProject}
              onDelete={handleDelete}
              isDeleting={deletingId === project.projectId}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
