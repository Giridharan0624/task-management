'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject, useDeleteProject, useUpdateProject, useProjectStatus } from '@/lib/hooks/useProjects'
import { useTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePermission } from '@/lib/hooks/usePermission'
import { TaskKanban } from '@/components/task/TaskKanban'
import { MemberList } from '@/components/project/MemberList'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
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
  const updateProject = useUpdateProject(projectId)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'progress'>('tasks')
  const { data: projectStatus } = useProjectStatus(projectId)

  const currentMember = project?.members?.find((m) => m.userId === user?.userId)
  const projectRole = currentMember?.projectRole as ProjectRole | undefined
  const permissions = usePermission(projectRole, user?.systemRole)

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return
    await deleteProject.mutateAsync(projectId)
    router.push('/projects')
  }

  const openEditModal = () => {
    setEditName(project?.name ?? '')
    setEditDesc(project?.description ?? '')
    setShowEditModal(true)
  }

  const handleUpdateProject = async () => {
    await updateProject.mutateAsync({ name: editName, description: editDesc })
    setShowEditModal(false)
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
            <p className="text-xs text-gray-400 mt-1">
              {project.members?.length ?? 0} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {permissions.canManageMembers && (
            <Button variant="secondary" size="sm" onClick={openEditModal}>
              Edit Project
            </Button>
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'tasks'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Tasks ({tasks?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Members ({project.members?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'progress'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Progress
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        tasksLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <TaskKanban
            projectId={projectId}
            tasks={tasks ?? []}
            permissions={permissions}
            members={project.members ?? []}
          />
        )
      )}

      {activeTab === 'members' && (
        <MemberList
          projectId={projectId}
          members={project.members ?? []}
          canManageMembers={permissions.canManageMembers}
        />
      )}

      {activeTab === 'progress' && projectStatus && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <p className="text-2xl font-bold text-indigo-700">{projectStatus.completionPercent}%</p>
              <p className="text-xs text-indigo-600">Tasks Done</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-2xl font-bold text-blue-700">{projectStatus.timeProgressPercent}%</p>
              <p className="text-xs text-blue-600">Time Used</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <p className="text-2xl font-bold text-green-700">{projectStatus.totalTrackedHours}h</p>
              <p className="text-xs text-green-600">Tracked</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-2xl font-bold text-gray-700">{projectStatus.totalEstimatedHours}h</p>
              <p className="text-xs text-gray-500">Estimated</p>
            </div>
          </div>

          {/* Overall Progress Bars */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Task Completion</span>
                <span className="text-gray-500">{projectStatus.taskCounts.DONE}/{projectStatus.totalTasks} tasks</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${projectStatus.completionPercent >= 100 ? 'bg-green-500' : projectStatus.completionPercent >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(projectStatus.completionPercent, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Time Budget</span>
                <span className="text-gray-500">{projectStatus.totalTrackedHours}h / {projectStatus.totalEstimatedHours}h</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${projectStatus.timeProgressPercent > 100 ? 'bg-red-500' : projectStatus.timeProgressPercent >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(projectStatus.timeProgressPercent, 100)}%` }}
                />
              </div>
              {projectStatus.timeProgressPercent > 100 && (
                <p className="text-xs text-red-500 mt-1 font-medium">Over budget by {(projectStatus.timeProgressPercent - 100).toFixed(1)}%</p>
              )}
            </div>
          </div>

          {/* Task Progress Table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Task Breakdown</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estimated</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracked</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projectStatus.taskProgress.map((t) => (
                    <tr key={t.taskId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.status === 'DONE' ? 'bg-green-100 text-green-700' :
                          t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{t.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.estimatedHours}h</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.trackedHours}h</td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                t.progressPercent > 100 ? 'bg-red-500' :
                                t.progressPercent >= 80 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(t.progressPercent, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${t.progressPercent > 100 ? 'text-red-600' : 'text-gray-500'}`}>
                            {t.progressPercent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Member Contribution */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Team Contribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {projectStatus.memberProgress.map((m) => (
                <div key={m.userId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-600 font-medium text-xs">{m.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.projectRole}</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-indigo-700">{m.trackedHours}h</p>
                  <p className="text-xs text-gray-500">tracked</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Project">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleUpdateProject}
              disabled={updateProject.isPending || !editName.trim()}
            >
              {updateProject.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
