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
import { TASK_STATUS_PROGRESS, TASK_STATUS_LABEL, DOMAIN_LABELS, DOMAIN_OPTIONS, getStatusProgress } from '@/types/task'
import type { TaskDomain } from '@/types/task'
import { formatDuration } from '@/lib/utils/formatDuration'
import { ProjectReport } from '@/components/reports/ProjectReport'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { parseDeadline, isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { useConfirm } from '@/components/ui/ConfirmDialog'

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
  const [editDomain, setEditDomain] = useState('')
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'progress' | 'reports'>('tasks')
  const { data: projectStatus } = useProjectStatus(projectId)

  const currentMember = project?.members?.find((m) => m.userId === user?.userId)
  const projectRole = currentMember?.projectRole as ProjectRole | undefined
  const permissions = usePermission(projectRole, user?.systemRole)

  const confirm = useConfirm()

  const handleDeleteProject = async () => {
    if (!await confirm({ title: 'Delete Project', description: 'This will permanently delete the project, all tasks, and member assignments. This cannot be undone.', confirmLabel: 'Delete' })) return
    await deleteProject.mutateAsync(projectId)
    router.push('/projects')
  }

  const openEditModal = () => {
    setEditName(project?.name ?? '')
    setEditDesc(project?.description ?? '')
    setEditDomain(project?.domain ?? 'DEVELOPMENT')
    setShowEditModal(true)
  }

  const handleUpdateProject = async () => {
    await updateProject.mutateAsync({ name: editName, description: editDesc, domain: editDomain })
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
  const activeTasks = totalTasks - doneTasks
  const projDomain = (project.domain as TaskDomain) || 'DEVELOPMENT'
  const completionPct = totalTasks > 0 ? Math.round((tasks ?? []).reduce((sum, t) => sum + getStatusProgress(t.status, projDomain), 0) / totalTasks) : 0

  // Upcoming deadlines — tasks due in the next 7 days (not done)
  const now = new Date()
  const upcomingDeadlines = (tasks ?? [])
    .filter(t => t.status !== 'DONE' && t.deadline)
    .map(t => ({ ...t, deadlineDate: parseDeadline(t.deadline) }))
    .filter(t => {
      const diff = (t.deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      return diff <= 7 // Due within 7 days (includes overdue)
    })
    .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())

  const healthLabel = projectStatus?.health?.replace('_', ' ') ?? ''
  const healthConfig: Record<string, { bg: string; text: string; dot: string }> = {
    COMPLETED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    ON_TRACK: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    AT_RISK: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    BEHIND: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  }
  const hc = healthConfig[projectStatus?.health ?? ''] ?? healthConfig.ON_TRACK

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl">
      <Breadcrumbs items={[
        { label: 'Projects', href: '/projects' },
        { label: project.name },
      ]} />
      {/* Header Card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/projects" className="rounded-xl p-2 text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-lg">{project.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                {project.domain && (
                  <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border/80">
                    {DOMAIN_LABELS[project.domain as TaskDomain] || project.domain}
                  </span>
                )}
                {projectStatus && (
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold border ${hc.bg} ${hc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hc.dot}`} />
                    {healthLabel}
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground/70 mt-0.5">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {permissions.canManageMembers && (
              <button onClick={openEditModal} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground/85 hover:bg-muted transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </button>
            )}
            {permissions.canDeleteProject && (
              <button onClick={handleDeleteProject} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Stats + Progress row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-indigo-700">{project.members?.length ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Members</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-foreground/85">{totalTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Tasks</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{activeTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Active</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{doneTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Done</p>
          </div>
          {projectStatus && projectStatus.totalTrackedHours > 0 && (
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-violet-700">{formatDuration(projectStatus.totalTrackedHours)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Tracked</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold text-foreground/85">{completionPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
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

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-[13px] font-bold text-foreground/95">Upcoming Deadlines</h3>
            <span className="text-[11px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-md tabular-nums">{upcomingDeadlines.length}</span>
          </div>
          <div className="divide-y divide-border/60">
            {upcomingDeadlines.map(t => {
              const isOverdue = t.deadlineDate < now
              // Compare by calendar date to avoid time-of-day skew
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const deadlineDay = new Date(t.deadlineDate.getFullYear(), t.deadlineDate.getMonth(), t.deadlineDate.getDate())
              const diffDays = Math.round((deadlineDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
              const urgencyLabel = isOverdue
                ? `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`
                : diffDays === 0 ? 'Due today'
                : diffDays === 1 ? 'Due tomorrow'
                : `${diffDays} days left`
              return (
                <div key={t.taskId} className={`flex items-center gap-3 px-5 py-2.5 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : diffDays <= 2 ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <p className="text-[13px] font-medium text-foreground/95 flex-1 truncate">{t.title}</p>
                  <span className="text-[10px] font-semibold text-muted-foreground/70">{TASK_STATUS_LABEL[t.status]}</span>
                  <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${isOverdue ? 'text-red-600' : diffDays <= 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {urgencyLabel}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums flex-shrink-0">
                    {t.deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/80">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'tasks'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground/85 hover:border-border'
          }`}
        >
          Tasks ({tasks?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground/85 hover:border-border'
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
                : 'border-transparent text-muted-foreground hover:text-foreground/85 hover:border-border'
            }`}
          >
            Progress
          </button>
        )}
        {permissions.canManageMembers && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'reports'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground/85 hover:border-border'
            }`}
          >
            Reports
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
            domain={(project.domain as import('@/types/task').TaskDomain) || 'DEVELOPMENT'}
          />
        )
      )}

      {activeTab === 'members' && (
        <MemberList
          projectId={projectId}
          members={project.members ?? []}
          tasks={tasks ?? []}
          canManageMembers={permissions.canManageMembers}
          callerProjectRole={projectRole}
          callerSystemRole={user?.systemRole}
        />
      )}

      {activeTab === 'progress' && projectStatus && (() => {
        const healthConfig: Record<string, { bg: string; text: string; dot: string; icon: string }> = {
          COMPLETED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: '🎉' },
          ON_TRACK: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500', icon: '✓' },
          AT_RISK: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', icon: '⚠' },
          BEHIND: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500', icon: '!' },
        }
        const hc = healthConfig[projectStatus.health] || healthConfig.ON_TRACK
        const doneCount = projectStatus.taskCounts?.DONE ?? 0
        const todoCount = projectStatus.taskCounts?.TODO ?? 0
        const activeCount = (projectStatus.totalTasks ?? 0) - todoCount - doneCount

        return (
        <div className="space-y-5">

          {/* ── Top row: Score ring + Health + Stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Score + Progress card */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-5 mb-5">
                {/* Circular score */}
                <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={projectStatus.overallScore >= 100 ? '#10b981' : '#6366f1'} strokeWidth="3" strokeDasharray={`${projectStatus.overallScore} ${100 - projectStatus.overallScore}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-foreground tabular-nums">{projectStatus.overallScore}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground/95 mb-1">Overall Score</p>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${hc.bg} ${hc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hc.dot}`} />
                    {projectStatus.health.replace('_', ' ')}
                  </span>
                  {projectStatus.overdueCount > 0 && (
                    <p className="text-[11px] text-red-500 font-medium mt-1.5">{projectStatus.overdueCount} overdue task{projectStatus.overdueCount > 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-border">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-medium text-muted-foreground">Completion</span>
                    <span className="font-bold text-foreground/85 tabular-nums">{projectStatus.completionPercent}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${projectStatus.completionPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(projectStatus.completionPercent, 100)}%` }} />
                  </div>
                </div>
                {projectStatus.totalEstimatedHours > 0 && (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-medium text-muted-foreground">Time Budget</span>
                      <span className="font-bold text-foreground/85 tabular-nums">{projectStatus.timeBudgetPercent}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${projectStatus.timeBudgetPercent > 100 ? 'bg-red-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(projectStatus.timeBudgetPercent, 100)}%` }} />
                    </div>
                  </div>
                )}
                {projectStatus.totalTrackedHours > 0 && (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-muted-foreground/70">Time Tracked</span>
                    <span className="font-semibold text-muted-foreground tabular-nums">{formatDuration(projectStatus.totalTrackedHours)}{projectStatus.totalEstimatedHours > 0 ? ` / ${formatDuration(projectStatus.totalEstimatedHours)}` : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Task Counts card */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-3">Task Counts</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3.5">
                  <p className="text-2xl font-bold text-amber-600 tabular-nums">{todoCount}</p>
                  <p className="text-[10px] text-amber-600/70 font-semibold mt-0.5">To Do</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3.5">
                  <p className="text-2xl font-bold text-blue-600 tabular-nums">{activeCount}</p>
                  <p className="text-[10px] text-blue-600/70 font-semibold mt-0.5">Active</p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3.5">
                  <p className="text-2xl font-bold text-emerald-600 tabular-nums">{doneCount}</p>
                  <p className="text-[10px] text-emerald-600/70 font-semibold mt-0.5">Done</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3.5">
                  <p className="text-2xl font-bold text-red-600 tabular-nums">{projectStatus.overdueCount}</p>
                  <p className="text-[10px] text-red-600/70 font-semibold mt-0.5">Overdue</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Task Breakdown ── */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-foreground/95">Task Breakdown</h3>
              <span className="text-[11px] text-muted-foreground/70 tabular-nums">{projectStatus.taskProgress.length} tasks</span>
            </div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_80px_100px_60px] gap-2 px-5 py-2 bg-muted/40 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider border-b border-border">
              <span>Task</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Time</span>
              <span className="text-right">Progress</span>
            </div>
            <div className="divide-y divide-border/60">
              {projectStatus.taskProgress.map((t) => {
                const color = t.statusProgress >= 100 ? '#10b981' : t.statusProgress >= 50 ? '#6366f1' : t.statusProgress >= 15 ? '#3b82f6' : '#d1d5db'
                const statusLabel = TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL] ?? t.status.replace(/_/g, ' ')
                return (
                  <div key={t.taskId} className={`grid grid-cols-[1fr_100px_80px_100px_60px] gap-2 items-center px-5 py-2.5 ${t.isOverdue ? 'bg-red-50/30' : 'hover:bg-muted/30'} transition-colors`}>
                    {/* Task name */}
                    <div className="min-w-0 flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground/95 truncate">{t.title}</p>
                      {t.isOverdue && <span className="text-[8px] font-bold text-red-500 bg-red-50 border border-red-100 px-1 py-px rounded flex-shrink-0">OVERDUE</span>}
                    </div>

                    {/* Status */}
                    <span className="text-[11px] font-medium text-muted-foreground">{statusLabel}</span>

                    {/* Priority */}
                    <div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                        t.priority === 'HIGH' ? 'text-red-600' : t.priority === 'MEDIUM' ? 'text-amber-600' : 'text-muted-foreground/70'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          t.priority === 'HIGH' ? 'bg-red-500' : t.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-gray-300'
                        }`} />
                        {t.priority}
                      </span>
                    </div>

                    {/* Time tracked */}
                    <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                      {t.trackedHours > 0 ? formatDuration(t.trackedHours) : '—'}
                    </span>

                    {/* Progress */}
                    <div className="flex items-center gap-1.5 justify-end">
                      <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.statusProgress}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{t.statusProgress}%</span>
                    </div>
                  </div>
                )
              })}
              {projectStatus.taskProgress.length === 0 && (
                <div className="px-5 py-8 text-center text-[13px] text-muted-foreground/50">No tasks yet</div>
              )}
            </div>
          </div>

          {/* ── Team Contribution ── */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h3 className="text-[13px] font-bold text-foreground/95">Team Contribution</h3>
            </div>
            <div className="divide-y divide-border/60">
              {projectStatus.memberProgress.map((m) => (
                <div key={m.userId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <Avatar name={m.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold text-foreground/95 truncate">{m.name}</p>
                      <span className="text-[9px] font-bold text-muted-foreground/70 uppercase">{m.projectRole}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px]">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${m.completionPercent}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 tabular-nums">{m.completionPercent}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] font-semibold text-foreground/85 tabular-nums">{m.doneTasks}/{m.totalTasks}</p>
                    <p className="text-[10px] text-muted-foreground/70">tasks done</p>
                  </div>
                  {m.trackedHours > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[12px] font-semibold text-foreground/85 tabular-nums">{formatDuration(m.trackedHours)}</p>
                      <p className="text-[10px] text-muted-foreground/70">tracked</p>
                    </div>
                  )}
                </div>
              ))}
              {projectStatus.memberProgress.length === 0 && (
                <div className="px-5 py-8 text-center text-[13px] text-muted-foreground/50">No members yet</div>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {activeTab === 'reports' && (
        <ProjectReport projectId={projectId} projectName={project.name} />
      )}

      {/* Edit Project Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Project Settings" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column — Editable Fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Project Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-card transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
              <textarea
                className="w-full rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground/85 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-card resize-none transition-all"
                rows={4}
                placeholder="What is this project about?"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Domain</label>
              <div className="grid grid-cols-2 gap-2">
                {DOMAIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditDomain(opt.value)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                      editDomain === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-border/80 bg-card text-muted-foreground hover:border-border hover:bg-muted/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">Changing the domain updates the task pipeline stages for this project.</p>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground/70 pt-2">
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
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Overview</label>
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Team</label>
              {(project.members ?? []).length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border/80 py-6 text-center">
                  <p className="text-sm text-muted-foreground/70">No members yet</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(project.members ?? []).map((m) => (
                    <div key={m.userId} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 border border-border">
                      <div className="flex items-center gap-2.5">
                        <Avatar url={m.user?.avatarUrl} name={m.user?.name || m.user?.email || m.userId} size="md" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.user?.name || m.user?.email || m.userId}</p>
                          {m.user?.email && m.user?.name && (
                            <p className="text-xs text-muted-foreground/70">{m.user.email}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-lg ${
                        m.projectRole === 'TEAM_LEAD' ? 'bg-orange-100 text-orange-600' :
                        m.projectRole === 'PROJECT_MANAGER' ? 'bg-indigo-100 text-indigo-600' :
                        m.projectRole === 'ADMIN' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>{m.projectRole === 'TEAM_LEAD' ? 'Lead' : m.projectRole === 'PROJECT_MANAGER' ? 'PM' : m.projectRole}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground/70 mt-2">Manage team from the <strong>Members</strong> tab</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
