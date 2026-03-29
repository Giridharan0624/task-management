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
import { Avatar } from '@/components/ui/AvatarUpload'
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
  const [editEstHours, setEditEstHours] = useState('')
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
    setEditEstHours(project?.estimatedHours ? String(project.estimatedHours) : '')
    setShowEditModal(true)
  }

  const handleUpdateProject = async () => {
    const estHours = editEstHours ? parseFloat(editEstHours) : undefined
    await updateProject.mutateAsync({ name: editName, description: editDesc, estimatedHours: estHours })
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

  const totalTasks = tasks?.length ?? 0
  const doneTasks = tasks?.filter((t) => t.status === 'DONE').length ?? 0
  const inProgressTasks = tasks?.filter((t) => t.status === 'IN_PROGRESS').length ?? 0
  const todoTasks = totalTasks - doneTasks - inProgressTasks
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/projects"
              className="rounded-xl p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-lg">{project.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-gray-400 mt-0.5">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {permissions.canManageMembers && (
              <Button variant="secondary" size="sm" onClick={openEditModal}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </Button>
            )}
            {permissions.canDeleteProject && (
              <Button variant="danger" size="sm" onClick={handleDeleteProject} loading={deleteProject.isPending}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-indigo-700">{project.members?.length ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Members</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-gray-700">{totalTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Tasks</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{inProgressTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">In Progress</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{doneTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Completed</p>
          </div>
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">Overall Progress</span>
              <span className="font-semibold text-gray-700">{completionPct}% complete</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  completionPct >= 100 ? 'bg-emerald-500' : completionPct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(completionPct, 100)}%` }}
              />
            </div>
          </div>
        )}
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
        {permissions.canManageMembers && (
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
        )}
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
          callerProjectRole={projectRole}
          callerSystemRole={user?.systemRole}
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
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
                    <Avatar name={m.name} size="md" />
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
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Project Settings" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column — Editable Fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Project Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
              <textarea
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white resize-none transition-all"
                rows={4}
                placeholder="What is this project about?"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Time Budget</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 100"
                  value={editEstHours}
                  onChange={(e) => setEditEstHours(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-16 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">hours</span>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-400 pt-2">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Created {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Updated {new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
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

          {/* Right Column — Overview */}
          <div className="space-y-5">
            {/* Stats */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Overview</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-indigo-50 rounded-xl p-3 text-center border border-indigo-100">
                  <p className="text-xl font-bold text-indigo-700">{project.members?.length ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold">Members</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-xl font-bold text-blue-700">{tasks?.length ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold">Tasks</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                  <p className="text-xl font-bold text-green-700">{tasks?.filter(t => t.status === 'DONE').length ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-green-500 font-semibold">Done</p>
                </div>
              </div>
            </div>

            {/* Team */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Team</label>
              {(project.members ?? []).length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 py-6 text-center">
                  <p className="text-sm text-gray-400">No members yet</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(project.members ?? []).map((m) => (
                    <div key={m.userId} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 border border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <Avatar url={m.user?.avatarUrl} name={m.user?.name || m.user?.email || m.userId} size="md" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.user?.name || m.user?.email || m.userId}</p>
                          {m.user?.email && m.user?.name && (
                            <p className="text-xs text-gray-400">{m.user.email}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-lg ${
                        m.projectRole === 'TEAM_LEAD' ? 'bg-orange-100 text-orange-600' :
                        m.projectRole === 'ADMIN' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>{m.projectRole === 'TEAM_LEAD' ? 'Lead' : m.projectRole}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Manage team from the <strong>Members</strong> tab</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
