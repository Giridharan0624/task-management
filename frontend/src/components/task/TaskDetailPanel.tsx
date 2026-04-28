'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useUpdateTask, useAssignTask, taskKeys } from '@/lib/hooks/useTasks'
import { deleteTask as deleteTaskApi } from '@/lib/api/taskApi'
import { useUndoableDelete } from '@/lib/hooks/useUndoableDelete'
import { useComments, useCreateComment } from '@/lib/hooks/useComments'
import { useProject } from '@/lib/hooks/useProjects'
import { useAdmins, useUsers } from '@/lib/hooks/useUsers'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import { DOMAIN_STATUSES, DOMAIN_OPTIONS, getStatusOptions, getStatusProgress } from '@/types/task'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import type { TaskDomain } from '@/types/task'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { DeadlineLabel } from '@/components/ui/DeadlineLabel'
import { DraftRestoreBanner } from '@/components/ui/DraftRestoreBanner'
import { useAutosaveDraft } from '@/lib/hooks/useAutosaveDraft'
import type { Permissions } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Select } from '@/components/ui/Select'
import { UserSelect } from '@/components/ui/UserSelect'
import { DateTimePicker } from '@/components/ui/DateTimePicker'

const STATUS_DOT_COLORS: Record<string, string> = {
  TODO: '#f59e0b', IN_PROGRESS: '#3b82f6', DEVELOPED: '#8b5cf6', CODE_REVIEW: '#a855f7',
  TESTING: '#f97316', TESTED: '#14b8a6', DEBUGGING: '#ef4444', FINAL_TESTING: '#ec4899',
  WIREFRAME: '#64748b', DESIGN: '#6366f1', REVIEW: '#06b6d4', REVISION: '#f43f5e', APPROVED: '#10b981',
  PLANNING: '#6366f1', EXECUTION: '#3b82f6',
  RESEARCH: '#8b5cf6', ANALYSIS: '#14b8a6', DOCUMENTATION: '#f97316',
  DONE: '#10b981',
}

function StatusDropdown({ value, onChange, disabled, domain }: { value: string; onChange: (v: string) => void; disabled?: boolean; domain: TaskDomain }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = getStatusOptions(domain)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Element)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)
  const dotColor = STATUS_DOT_COLORS[value] || '#9ca3af'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-[12px] font-semibold text-foreground/85 hover:border-border transition-all disabled:opacity-50"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        {selected?.label || value}
        <svg className={`w-3 h-3 text-muted-foreground/70 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[99999] bg-card rounded-xl shadow-2xl ring-1 ring-border/60 py-1 min-w-[160px] max-h-[240px] overflow-y-auto animate-fade-in-scale" style={{ animationDuration: '0.1s' }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors ${
                value === opt.value ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_DOT_COLORS[opt.value] || '#9ca3af' }} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TaskDetailPanelProps {
  task: Task | null
  projectId: string
  permissions: Permissions
  onClose: () => void
}

interface EditFormValues {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  domain: TaskDomain
  deadline: string
}

export function TaskDetailPanel({ task, projectId, permissions, onClose }: TaskDetailPanelProps) {
  const { user } = useAuth()
  const { data: project } = useProject(projectId)
  const labelOf = useStatusLabel()
  const updateTask = useUpdateTask(projectId)
  const assignTask = useAssignTask(projectId)
  const toast = useToast()
  const undoableDeleteTask = useUndoableDelete<Task, 'taskId'>({
    queryKey: taskKeys.all(projectId),
    idKey: 'taskId',
    commit: (taskId) => deleteTaskApi(projectId, taskId),
    invalidate: [['my-tasks'], ['projects']],
    entityLabel: 'Task',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [showAssignInput, setShowAssignInput] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [commentText, setCommentText] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Autosave comment draft per-task so a half-typed comment survives
  // accidentally closing the panel.
  const commentDraftKey = task ? `comment:${task.taskId}` : 'comment:none'
  const commentDraft = useAutosaveDraft(commentDraftKey, commentText, {
    enabled: !!task,
  })
  // Silently re-hydrate the textarea on mount when a draft is available.
  // The "banner" pattern is overkill for one-line comments — showing the
  // text back is enough signal on its own.
  useEffect(() => {
    if (commentDraft.pendingRestore?.value && !commentText) {
      setCommentText(commentDraft.pendingRestore.value)
      commentDraft.dismissRestore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentDraft.pendingRestore?.value])

  const { data: comments } = useComments(projectId, task?.taskId ?? '')
  const createComment = useCreateComment(projectId, task?.taskId ?? '')
  const { data: admins } = useAdmins()
  const { data: allUsers } = useUsers()

  const members = project?.members ?? []
  const nameMap = new Map<string, string>()
  const avatarMap = new Map<string, string | undefined>()

  // Add all users (if available — privileged users can fetch this)
  for (const u of allUsers ?? []) {
    nameMap.set(u.userId, u.name || u.email)
    if (u.avatarUrl) avatarMap.set(u.userId, u.avatarUrl)
  }
  // Add project members (enriched with user data)
  for (const m of members) {
    nameMap.set(m.userId, m.user?.name || m.user?.email || m.userId)
    if (m.user?.avatarUrl) avatarMap.set(m.userId, m.user.avatarUrl)
  }
  // Add current user
  if (user) nameMap.set(user.userId, user.name || user.email)
  // Add admins/owners
  for (const a of admins ?? []) {
    if (!nameMap.has(a.userId)) nameMap.set(a.userId, a.name || a.email)
  }

  const resolveName = (userId: string) => nameMap.get(userId) || 'Unknown'
  const resolveAvatar = (userId: string) => avatarMap.get(userId)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({ mode: 'onTouched' })

  // Autosave the edit-form description while in edit mode, keyed per task.
  const editDescriptionDraftKey = task
    ? `task:edit:${task.taskId}:description`
    : 'task:edit:none'
  const editDescription = watch('description') ?? ''
  const editDraft = useAutosaveDraft(
    editDescriptionDraftKey,
    editDescription,
    {
      enabled: isEditing && !!task,
      emptyValue: task?.description ?? '',
    }
  )

  // Reset form when a DIFFERENT task is selected (not on every data refetch)
  const taskId = task?.taskId ?? null
  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        domain: (task.domain as TaskDomain) || 'DEVELOPMENT',
        deadline: task.deadline ? task.deadline.slice(0, 16) : '',
      })
      setIsEditing(false)
      setShowAssignInput(false)
      setCommentText('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const confirm = useConfirm()

  useEffect(() => {
    if (!task) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [task, onClose])

  if (!task) return null

  const handleSave = async (values: EditFormValues) => {
    // Reject past-date deadlines on edit too. Only blocks when the deadline
    // moved — don't punish the user for leaving an already-past deadline
    // untouched on a legacy task.
    if (
      values.deadline &&
      values.deadline !== task.deadline?.slice(0, 16) &&
      new Date(values.deadline).getTime() < Date.now()
    ) {
      toast.error('Deadline cannot be in the past.')
      return
    }
    editDraft.clear()
    await updateTask.mutateAsync({
      taskId: task.taskId,
      data: {
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        domain: values.domain,
        deadline: values.deadline || undefined,
      },
    })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!await confirm({
      title: 'Delete Task',
      description: 'You have 5 seconds to undo after the task is hidden.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })) return
    undoableDeleteTask(task)
    onClose()
  }

  const handleAssign = async () => {
    if (!selectedAssignee) return
    const newAssignees = [...(task.assignedTo ?? []), selectedAssignee]
    await assignTask.mutateAsync({ taskId: task.taskId, assignedTo: newAssignees })
    setShowAssignInput(false)
    setSelectedAssignee('')
  }

  const handleUnassign = async (userId: string) => {
    const newAssignees = (task.assignedTo ?? []).filter((id) => id !== userId)
    await assignTask.mutateAsync({ taskId: task.taskId, assignedTo: newAssignees })
  }

  const handlePostComment = async () => {
    if (!commentText.trim()) return
    await createComment.mutateAsync(commentText.trim())
    setCommentText('')
    commentDraft.clear()
  }

  const handleStatusChange = async (newStatus: TaskStatus) => {
    const previousStatus = task.status
    if (previousStatus === newStatus) return

    // Reopening a completed task is almost always an accident. Force an
    // explicit confirm so a mis-click doesn't silently un-finish work the
    // team thought was shipped.
    if (previousStatus === 'DONE' && newStatus !== 'DONE') {
      const ok = await confirm({
        title: 'Reopen completed task?',
        description:
          'This task is marked Done. Changing its status will move it back into active work. Continue?',
        confirmLabel: 'Reopen task',
        variant: 'danger',
      })
      if (!ok) return
    }

    setStatusUpdating(true)
    try {
      await updateTask.mutateAsync({ taskId: task.taskId, data: { status: newStatus } })
      if (previousStatus !== newStatus) {
        const newLabel = labelOf(newStatus)
        toast.undoable(
          `Status changed to ${newLabel}`,
          () => {
            updateTask.mutate({
              taskId: task.taskId,
              data: { status: previousStatus },
            })
          }
        )
      }
    } finally {
      setStatusUpdating(false)
    }
  }

  const isAssigned = task.assignedTo?.includes(user?.userId ?? '')
  const isOwnerOrAdmin = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const canComment = isAssigned || isOwnerOrAdmin
  const assignedSet = new Set(task.assignedTo ?? [])
  const availableMembers = members.filter((m) => !assignedSet.has(m.userId))

  const isOverdue = checkOverdue(task.deadline, task.status)

  const panel = (
    <div className="fixed inset-0 z-[9998] overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center py-8 px-4">
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-card rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15),0_10px_30px_-8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col max-h-[90vh] animate-fade-in-scale"
      >

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0 transition-colors ${isEditing ? 'bg-amber-50 border-amber-100' : 'border-border'}`}>
          <div className="flex items-center gap-2">
            {isEditing && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            <h2 className={`text-[13px] font-bold ${isEditing ? 'text-amber-800' : 'text-foreground'}`}>
              {isEditing ? 'Editing Task' : 'Task Details'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {permissions.canUpdateTask && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground/85 hover:bg-muted transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </button>
            )}
            {permissions.canDeleteTask && !isEditing && (
              <button onClick={handleDelete} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted transition-all">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-5 overflow-y-auto min-h-0">
          {isEditing ? (
            <form onSubmit={handleSubmit(handleSave)} className="flex flex-col gap-5">
              {editDraft.pendingRestore &&
                editDraft.pendingRestore.value.trim() &&
                editDraft.pendingRestore.value !== (task.description ?? '') && (
                  <DraftRestoreBanner
                    savedAt={editDraft.pendingRestore.savedAt}
                    onRestore={() => {
                      const v = editDraft.pendingRestore?.value ?? ''
                      setValue('description', v, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      editDraft.dismissRestore()
                    }}
                    onDismiss={editDraft.dismissRestore}
                    entityLabel="description edit"
                  />
                )}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 block">Title</label>
                <input
                  {...register('title', { required: 'Title is required' })}
                  className="w-full rounded-lg border border-border/80 bg-card px-3.5 py-2.5 text-[14px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
                />
                {errors.title && <p className="text-[11px] text-red-500 mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea
                  rows={3}
                  {...register('description')}
                  placeholder="Add a description..."
                  className="w-full rounded-lg border border-border/80 bg-card px-3.5 py-2.5 text-[13px] text-foreground/85 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 resize-none transition-all"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 block">Priority</label>
                  <Select
                    value={watch('priority')}
                    onChange={(v) => setValue('priority', v as TaskPriority)}
                    options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 block">Workflow</label>
                  <Select
                    value={watch('domain')}
                    onChange={(v) => {
                      const newDomain = v as TaskDomain
                      setValue('domain', newDomain)
                      // Reset status if current status doesn't exist in the new domain
                      const newStatuses = DOMAIN_STATUSES[newDomain]
                      if (!newStatuses.includes(watch('status'))) {
                        setValue('status', 'TODO')
                      }
                    }}
                    options={DOMAIN_OPTIONS}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 block">Deadline</label>
                <DateTimePicker
                  value={watch('deadline') || ''}
                  onChange={(v) => setValue('deadline', v)}
                />
              </div>
              {updateTask.error && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
                  {updateTask.error instanceof Error ? updateTask.error.message : 'Update failed'}
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button type="button" onClick={() => setIsEditing(false)} className="text-[12px] font-medium text-muted-foreground hover:text-foreground/85 transition-colors">
                  Cancel
                </button>
                <Button type="submit" loading={isSubmitting}>Save Changes</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col min-h-full">

              {/* ── Title + Badges ── */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground leading-snug mb-2">{task.title}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAssigned ? (
                    <StatusDropdown
                      value={task.status}
                      onChange={(v) => handleStatusChange(v as TaskStatus)}
                      disabled={statusUpdating}
                      domain={((project?.domain || task.domain) as TaskDomain) || 'DEVELOPMENT'}
                    />
                  ) : (
                    <Badge variant={task.status}>{labelOf(task.status)}</Badge>
                  )}
                  <Badge variant={task.priority}>{task.priority}</Badge>
                  {isOverdue && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md ring-1 ring-inset ring-red-200">OVERDUE</span>
                  )}
                </div>
              </div>

              {/* ── Inline Progress ── */}
              {(() => {
                const taskDomain = ((project?.domain || task.domain) as TaskDomain) || 'DEVELOPMENT'
                const STAGES = DOMAIN_STATUSES[taskDomain] || DOMAIN_STATUSES['DEVELOPMENT']
                const STAGE_CLR = STATUS_DOT_COLORS
                const currentIdx = STAGES.indexOf(task.status)
                const pct = getStatusProgress(task.status, taskDomain)
                return (
                  <div className="mb-5">
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className="flex items-center gap-1 flex-1">
                        {STAGES.map((s, i) => (
                          <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                            {i <= currentIdx && (
                              <div className="h-full w-full rounded-full" style={{ backgroundColor: STAGE_CLR[task.status] }} />
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: STAGE_CLR[task.status] }}>{pct}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/50">{labelOf(STAGES[0])}</span>
                      <span className="text-[10px] font-medium" style={{ color: STAGE_CLR[task.status] }}>Stage {currentIdx + 1}/{STAGES.length}</span>
                      <span className="text-[10px] text-muted-foreground/50">{labelOf(STAGES[STAGES.length - 1])}</span>
                    </div>
                  </div>
                )
              })()}

              {/* ── Description ── */}
              {task.description && (
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 whitespace-pre-wrap">{task.description}</p>
              )}

              {/* ── Metadata Grid ── */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <div className="bg-muted/40 rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">Deadline</p>
                  <p className="text-[12px] font-semibold mt-0.5">
                    {task.deadline ? (
                      <DeadlineLabel
                        deadline={task.deadline}
                        status={task.status}
                      />
                    ) : (
                      <span className="text-foreground/95">—</span>
                    )}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">Created</p>
                  <p className="text-[12px] font-semibold text-foreground/95 mt-0.5">{new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">Created by</p>
                  <p className="text-[12px] font-semibold text-foreground/95 mt-0.5 truncate">{resolveName(task.createdBy)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">Assigned by</p>
                  <p className="text-[12px] font-semibold text-foreground/95 mt-0.5 truncate">{task.assignedBy ? resolveName(task.assignedBy) : '—'}</p>
                </div>
              </div>

              {/* ── Assignees ── */}
              <div className="mb-5 pb-5 border-b border-border">
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2.5">Assigned To</p>
                <div className="flex items-center flex-wrap gap-2">
                  {task.assignedTo && task.assignedTo.length > 0 ? (
                    task.assignedTo.map((userId) => (
                      <div key={userId} className="inline-flex items-center gap-2 bg-muted/40 rounded-full pl-1 pr-2.5 py-1 border border-border">
                        <Avatar url={resolveAvatar(userId)} name={resolveName(userId)} size="sm" />
                        <span className="text-[12px] font-medium text-foreground/95">{resolveName(userId)}</span>
                        {permissions.canAssignTask && (
                          <button onClick={() => handleUnassign(userId)} className="text-muted-foreground/50 hover:text-red-500 transition-colors ml-0.5" title="Remove">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground/50 italic">No one assigned</p>
                  )}
                  {permissions.canAssignTask && !showAssignInput && (
                    <button onClick={() => setShowAssignInput(true)} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      Add
                    </button>
                  )}
                </div>
                {permissions.canAssignTask && showAssignInput && (
                  <div className="mt-3 space-y-2">
                    {availableMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 italic">All members assigned.</p>
                    ) : (
                      <UserSelect
                        users={availableMembers.map((m) => ({ userId: m.userId, name: m.user?.name || m.user?.email || m.userId, email: m.user?.email || '', avatarUrl: m.user?.avatarUrl, extra: m.projectRole }))}
                        value={selectedAssignee}
                        onChange={setSelectedAssignee}
                        placeholder="Search member..."
                      />
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAssign} loading={assignTask.isPending} disabled={!selectedAssignee}>Add</Button>
                      <button onClick={() => { setShowAssignInput(false); setSelectedAssignee('') }} className="text-xs text-muted-foreground/70 hover:text-muted-foreground">Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Updates / Comments ── */}
              <div className="flex-1 flex flex-col">
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">
                  Updates {comments && comments.length > 0 && <span className="text-indigo-500">({comments.length})</span>}
                </p>

                {comments && comments.length > 0 ? (
                  <div className="space-y-2.5 mb-4 flex-1">
                    {comments.map((comment) => (
                      <div key={comment.commentId} className="flex gap-2.5">
                        <Avatar url={resolveAvatar(comment.authorId)} name={resolveName(comment.authorId)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px] font-bold text-foreground/95">{resolveName(comment.authorId)}</span>
                            <RelativeTime
                              value={comment.createdAt}
                              className="text-[10px] text-muted-foreground/70"
                            />
                          </div>
                          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground/50 mb-4 flex-1">No updates yet.</p>
                )}

                {canComment && (
                  <div className="flex gap-2 items-start pt-3 border-t border-border">
                    <textarea
                      rows={1}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an update..."
                      className="flex-1 rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-[13px] placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-indigo-500/40 focus:bg-card resize-none transition-all"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() } }}
                    />
                    <Button size="sm" onClick={handlePostComment} loading={createComment.isPending} disabled={!commentText.trim()}>Post</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
