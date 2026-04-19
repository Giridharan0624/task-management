'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, FolderPlus } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useProjects, useDeleteProject } from '@/lib/hooks/useProjects'
import { useUsers } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ProjectCard } from './ProjectCard'
import { ProjectListRow } from './ProjectListRow'
import { CreateProjectModal } from './CreateProjectModal'
import {
  ProjectsToolbar,
  type ProjectView,
  type ProjectDomainFilter,
  type ProjectStatusFilter,
  type ProjectSort,
} from './ProjectsToolbar'
import { ProjectStatStrip } from './ProjectStatStrip'
import type { Project } from '@/types/project'

/** A project is "at risk" if it has tasks, is below half done, and has been
 *  idle for more than two weeks. Pure client-side heuristic — no per-project
 *  API call needed. */
function isAtRisk(p: Project): boolean {
  const taskCount = p.taskCount ?? 0
  if (taskCount === 0) return false
  const pct = p.completionPercent ?? 0
  if (pct >= 50) return false
  const lastActivity = p.updatedAt || p.createdAt
  if (!lastActivity) return false
  const days = (Date.now() - new Date(lastActivity).getTime()) / 86400000
  return days > 14
}

function isCompleted(p: Project): boolean {
  return (p.completionPercent ?? 0) >= 100 && (p.taskCount ?? 0) > 0
}

export function ProjectList() {
  const { user } = useAuth()
  const systemPerms = useSystemPermission(user?.systemRole)
  const { data: projects, isLoading, error } = useProjects()
  const { data: allUsers } = useUsers()
  const deleteProject = useDeleteProject()
  const confirm = useConfirm()
  const toast = useToast()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState<ProjectDomainFilter>('ALL')
  const [status, setStatus] = useState<ProjectStatusFilter>('ALL')
  const [sort, setSort] = useState<ProjectSort>('recent')
  const [view, setView] = useState<ProjectView>('grid')

  const nameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of allUsers ?? []) m.set(u.userId, u.name || u.email)
    if (user) m.set(user.userId, user.name || user.email)
    return m
  }, [allUsers, user])

  // Stats — computed from the full project list, not filtered
  const stats = useMemo(() => {
    const list = projects ?? []
    const completed = list.filter(isCompleted).length
    const atRisk = list.filter(isAtRisk).length
    const active = list.length - completed
    return { total: list.length, active, completed, atRisk }
  }, [projects])

  // Filter + sort
  const visible = useMemo(() => {
    let list = projects ?? []

    if (domain !== 'ALL') {
      list = list.filter(
        (p) => (p.domain || 'DEVELOPMENT').toUpperCase() === domain
      )
    }

    if (status !== 'ALL') {
      if (status === 'COMPLETED') list = list.filter(isCompleted)
      else if (status === 'AT_RISK') list = list.filter(isAtRisk)
      else if (status === 'ACTIVE') list = list.filter((p) => !isCompleted(p))
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'progress')
        return (b.completionPercent ?? 0) - (a.completionPercent ?? 0)
      if (sort === 'members') {
        const am = a.memberCount ?? a.members?.length ?? 0
        const bm = b.memberCount ?? b.members?.length ?? 0
        return bm - am
      }
      // recent
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bt - at
    })
  }, [projects, domain, status, sort, search])

  const canClear = !!search || domain !== 'ALL' || status !== 'ALL'

  const handleDelete = async (projectId: string) => {
    const p = (projects ?? []).find((x) => x.projectId === projectId)
    if (!p) return
    const confirmed = await confirm({
      title: `Delete ${p.name}?`,
      description:
        'This permanently deletes the project and all its tasks. This action cannot be undone.',
      confirmLabel: 'Delete project',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteProject.mutateAsync(projectId)
      toast.success('Project deleted')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete project'
      )
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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load projects. Please try again.
        </AlertDescription>
      </Alert>
    )
  }

  const description =
    stats.total === 0
      ? 'Create a project to start organizing work.'
      : `${stats.active} active${stats.completed > 0 ? ` · ${stats.completed} completed` : ''}${stats.atRisk > 0 ? ` · ${stats.atRisk} at risk` : ''}`

  return (
    <div className="flex w-full max-w-7xl flex-col gap-5 animate-fade-in">
      <PageHeader title="Projects" description={description} />

      {stats.total > 0 && (
        <ProjectStatStrip
          total={stats.total}
          active={stats.active}
          completed={stats.completed}
          atRisk={stats.atRisk}
        />
      )}

      <ProjectsToolbar
        search={search}
        onSearchChange={setSearch}
        domain={domain}
        onDomainChange={setDomain}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
        canClear={canClear}
        onClear={() => {
          setSearch('')
          setDomain('ALL')
          setStatus('ALL')
        }}
        canCreate={systemPerms.canCreateProject}
        onCreate={() => setShowCreateModal(true)}
      />

      {visible.length === 0 ? (
        stats.total === 0 ? (
          <EmptyState
            icon={<FolderPlus className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />}
            title="No projects yet"
            description="Create a project to start organizing tasks, tracking time, and collaborating with your team."
            action={
              systemPerms.canCreateProject ? (
                <Button onClick={() => setShowCreateModal(true)}>
                  Create your first project
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            title="No projects match your filters"
            description="Try clearing filters or switching to a different domain."
          />
        )
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-fade stagger-up">
          {visible.map((project) => (
            <ProjectCard
              key={project.projectId}
              project={project}
              canDeleteProject={systemPerms.canCreateProject}
              onDelete={handleDelete}
              creatorName={nameMap.get(project.createdBy)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {visible.map((project) => (
            <ProjectListRow
              key={project.projectId}
              project={project}
              canDeleteProject={systemPerms.canCreateProject}
              onDelete={handleDelete}
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
