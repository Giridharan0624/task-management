'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject, useDeleteProject } from '@/lib/hooks/useProjects'
import { useTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePermission } from '@/lib/hooks/usePermission'
import { TaskKanban } from '@/components/task/TaskKanban'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { ProjectRole } from '@/types/user'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const router = useRouter()
  const { user } = useAuth()

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId)
  const { data: tasks, isLoading: tasksLoading } = useTasks(projectId)
  const deleteProject = useDeleteProject()

  // Determine current user's role in this project
  const currentMember = project?.members?.find((m) => m.userId === user?.userId)
  const projectRole = currentMember?.projectRole as ProjectRole | undefined
  const permissions = usePermission(projectRole, user?.systemRole)

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return
    await deleteProject.mutateAsync(projectId)
    router.push('/projects')
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        Failed to load project. It may not exist or you may not have access.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Back to projects"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="mt-0.5 text-sm text-gray-500">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {permissions.canManageMembers && (
            <Link href={`/projects/${projectId}/members`}>
              <Button variant="secondary" size="sm">
                Manage Members
              </Button>
            </Link>
          )}
          {permissions.canDeleteProject && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteProject}
              loading={deleteProject.isPending}
            >
              Delete Project
            </Button>
          )}
        </div>
      </div>

      {/* Kanban */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <TaskKanban
          projectId={projectId}
          tasks={tasks ?? []}
          permissions={permissions}
        />
      )}
    </div>
  )
}
