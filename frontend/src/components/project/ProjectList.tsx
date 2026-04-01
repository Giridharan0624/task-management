'use client'

import { useState } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useProjects, useDeleteProject } from '@/lib/hooks/useProjects'
import { useUsers } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { ProjectCard } from './ProjectCard'
import { CreateProjectModal } from './CreateProjectModal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function ProjectList() {
  const { user } = useAuth()
  const systemPerms = useSystemPermission(user?.systemRole)
  const { data: projects, isLoading, error } = useProjects()
  const { data: allUsers } = useUsers()
  const deleteProject = useDeleteProject()

  const nameMap = new Map<string, string>()
  for (const u of allUsers ?? []) nameMap.set(u.userId, u.name || u.email)
  if (user) nameMap.set(user.userId, user.name || user.email)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const confirm = useConfirm()

  const handleDelete = async (projectId: string) => {
    if (!await confirm({ title: 'Delete Project', description: 'This will permanently delete the project and all its tasks. This cannot be undone.', confirmLabel: 'Delete' })) return
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
      <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center text-red-700">
        Failed to load projects. Please try again.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Projects</h2>
          <p className="text-sm text-gray-400 mt-0.5">{projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        {systemPerms.canCreateProject && (
          <Button onClick={() => setShowCreateModal(true)}>Create Project</Button>
        )}
      </div>

      {!projects || projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">No projects yet.</p>
          {systemPerms.canCreateProject && (
            <Button onClick={() => setShowCreateModal(true)}>Create your first project</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-fade">
          {projects.map((project) => (
            <ProjectCard
              key={project.projectId}
              project={project}
              canDeleteProject={systemPerms.canCreateProject}
              onDelete={handleDelete}
              isDeleting={deletingId === project.projectId}
              creatorName={nameMap.get(project.createdBy)}
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
