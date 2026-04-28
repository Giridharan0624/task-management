'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, Calendar, RefreshCw } from 'lucide-react'
import {
  useProject,
  useDeleteProject,
  useUpdateProject,
  useProjectStatus,
} from '@/lib/hooks/useProjects'
import { useTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePermission } from '@/lib/hooks/usePermission'
import { TaskKanban } from '@/components/task/TaskKanban'
import { MemberList } from '@/components/project/MemberList'
import { ProjectReport } from '@/components/reports/ProjectReport'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import {
  DOMAIN_OPTIONS,
  getStatusProgress,
  type TaskDomain,
} from '@/types/task'
import type { ProjectRole } from '@/types/user'
import { formatDuration } from '@/lib/utils/formatDuration'
import { ProjectHeader } from '@/components/project/ProjectHeader'
import { useUsers } from '@/lib/hooks/useUsers'
import { ProjectDetailStatStrip } from '@/components/project/ProjectDetailStatStrip'
import {
  ProjectHealthCard,
  ProjectTaskCounts,
} from '@/components/project/ProjectHealthCard'
import { ProjectTaskBreakdown } from '@/components/project/ProjectTaskBreakdown'
import { TeamContribution } from '@/components/project/TeamContribution'
import { ProjectUpcomingDeadlines } from '@/components/project/ProjectUpcomingDeadlines'
import { cn } from '@/lib/utils'

type TabKey = 'tasks' | 'members' | 'progress' | 'reports'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const router = useRouter()
  const { user } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(projectId)
  const { data: tasks, isLoading: tasksLoading } = useTasks(projectId)
  const { data: allUsers } = useUsers()
  const deleteProject = useDeleteProject()
  const updateProject = useUpdateProject(projectId)

  const [activeTab, setActiveTab] = useState<TabKey>('tasks')
  // Only fetch status when Progress tab is active — saves a refetch every 30s.
  const { data: projectStatus } = useProjectStatus(projectId, {
    enabled: activeTab === 'progress',
  })

  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDomain, setEditDomain] = useState('')

  const currentMember = project?.members?.find((m) => m.userId === user?.userId)
  const projectRole = currentMember?.projectRole as ProjectRole | undefined
  const permissions = usePermission(projectRole, user?.systemRole)

  const handleDeleteProject = async () => {
    const confirmed = await confirm({
      title: `Delete ${project?.name ?? 'this project'}?`,
      description:
        'This permanently deletes the project, all its tasks, and member assignments. This action cannot be undone.',
      confirmLabel: 'Delete project',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteProject.mutateAsync(projectId)
      toast.success('Project deleted')
      router.push('/projects')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete project'
      )
    }
  }

  const openEditModal = () => {
    setEditName(project?.name ?? '')
    setEditDesc(project?.description ?? '')
    setEditDomain(project?.domain ?? 'DEVELOPMENT')
    setShowEditModal(true)
  }

  const handleUpdateProject = async () => {
    if (!editName.trim()) return
    try {
      await updateProject.mutateAsync({
        name: editName,
        description: editDesc,
        domain: editDomain,
      })
      setShowEditModal(false)
      toast.success('Project updated')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update project'
      )
    }
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Breadcrumbs
          items={[{ label: 'Projects', href: '/projects' }, { label: 'Not found' }]}
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load project. It may not exist or you may not have access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const totalTasks = tasks?.length ?? 0
  const doneTasks = tasks?.filter((t) => t.status === 'DONE').length ?? 0
  const activeTasks = totalTasks - doneTasks
  const projDomain = (project.domain as TaskDomain) || 'DEVELOPMENT'
  const completionPct =
    totalTasks > 0
      ? Math.round(
          (tasks ?? []).reduce(
            (sum, t) => sum + getStatusProgress(t.status, projDomain),
            0
          ) / totalTasks
        )
      : 0
  const trackedLabel =
    projectStatus && projectStatus.totalTrackedHours > 0
      ? formatDuration(projectStatus.totalTrackedHours)
      : null

  const memberCount = project.members?.length ?? 0

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
      />

      <ProjectHeader
        project={project}
        status={projectStatus ?? null}
        canEdit={permissions.canManageMembers}
        canDelete={permissions.canDeleteProject}
        onEdit={openEditModal}
        onDelete={handleDeleteProject}
        creatorName={
          (allUsers ?? []).find((u) => u.userId === project.createdBy)?.name ??
          undefined
        }
        completionPercent={completionPct}
        totalTasks={totalTasks}
      />

      <ProjectDetailStatStrip
        members={memberCount}
        totalTasks={totalTasks}
        activeTasks={activeTasks}
        doneTasks={doneTasks}
        trackedLabel={trackedLabel}
        completionPercent={completionPct}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2">
            Tasks
            <TabCount>{totalTasks}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            Members
            <TabCount>{memberCount}</TabCount>
          </TabsTrigger>
          {permissions.canManageMembers && (
            <TabsTrigger value="progress">Progress</TabsTrigger>
          )}
          {permissions.canManageMembers && (
            <TabsTrigger value="reports">Reports</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tasks" className="space-y-6">
          {/* Upcoming deadlines belongs with the task view — it's a
              filtered slice of the task list. Moved inside the Tasks
              tab so the tab bar above is never buried by it. */}
          <ProjectUpcomingDeadlines tasks={tasks ?? []} />

          {tasksLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <TaskKanban
              projectId={projectId}
              tasks={tasks ?? []}
              permissions={permissions}
              members={project.members ?? []}
              domain={projDomain}
            />
          )}
        </TabsContent>

        <TabsContent value="members">
          <MemberList
            projectId={projectId}
            members={project.members ?? []}
            tasks={tasks ?? []}
            canManageMembers={permissions.canManageMembers}
            callerProjectRole={projectRole}
            callerSystemRole={user?.systemRole}
          />
        </TabsContent>

        {permissions.canManageMembers && (
          <TabsContent value="progress">
            {!projectStatus ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <ProjectHealthCard status={projectStatus} />
                  <ProjectTaskCounts status={projectStatus} />
                </div>
                <ProjectTaskBreakdown status={projectStatus} />
                <TeamContribution status={projectStatus} />
              </div>
            )}
          </TabsContent>
        )}

        {permissions.canManageMembers && (
          <TabsContent value="reports">
            <ProjectReport projectId={projectId} projectName={project.name} />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Project Modal — single column, focused */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Project settings"
      >
        <div className="space-y-5">
          <Input
            label="Project name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="e.g. Website redesign"
          />

          <Textarea
            label="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="What is this project about?"
            rows={3}
          />

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Workflow
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DOMAIN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditDomain(opt.value)}
                  className={cn(
                    'rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all',
                    editDomain === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-border/70 hover:bg-muted/40'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Changing the workflow updates the task pipeline stages for this
              project.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Created{' '}
              {new Date(project.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Updated{' '}
              {new Date(project.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateProject}
              loading={updateProject.isPending}
              disabled={!editName.trim()}
            >
              Save changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/20 px-1 text-[10px] font-bold tabular-nums text-muted-foreground">
      {children}
    </span>
  )
}
