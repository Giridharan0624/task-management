'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useUpdateTask, useDeleteTask, useAssignTask } from '@/lib/hooks/useTasks'
import { useComments, useCreateComment } from '@/lib/hooks/useComments'
import { useProject } from '@/lib/hooks/useProjects'
import { useAdmins, useUsers } from '@/lib/hooks/useUsers'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import { TASK_STATUS_LABEL, TASK_STATUS_PROGRESS, DOMAIN_STATUSES, DOMAIN_OPTIONS, getStatusOptions, getStatusProgress } from '@/types/task'
import type { TaskDomain } from '@/types/task'
import { isOverdue as checkOverdue } from '@/lib/utils/deadline'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { Permissions } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Select } from '@/components/ui/Select'
import { UserSelect } from '@/components/ui/UserSelect'
import { DateTimePicker } from '@/components/ui/DateTimePicker'

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
  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)
  const assignTask = useAssignTask(projectId)
  const [isEditing, setIsEditing] = useState(false)
  const [showAssignInput, setShowAssignInput] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [commentText, setCommentText] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)

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
  } = useForm<EditFormValues>()

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
    if (!await confirm({ title: 'Delete Task', description: 'This task will be permanently deleted. This cannot be undone.', confirmLabel: 'Delete' })) return
    await deleteTask.mutateAsync(task.taskId)
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
  }

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setStatusUpdating(true)
    try {
      await updateTask.mutateAsync({ taskId: task.taskId, data: { status: newStatus } })
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
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15),0_10px_30px_-8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col max-h-[90vh] animate-fade-in-scale"
      >

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0 transition-colors ${isEditing ? 'bg-amber-50 border-amber-100' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2">
            {isEditing && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            <h2 className={`text-[13px] font-bold ${isEditing ? 'text-amber-800' : 'text-gray-900'}`}>
              {isEditing ? 'Editing Task' : 'Task Details'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {permissions.canUpdateTask && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all">
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
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-5 overflow-y-auto min-h-0">
          {isEditing ? (
            <form onSubmit={handleSubmit(handleSave)} className="flex flex-col gap-5">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Title</label>
                <input
                  {...register('title', { required: 'Title is required' })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[14px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all"
                />
                {errors.title && <p className="text-[11px] text-red-500 mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea
                  rows={3}
                  {...register('description')}
                  placeholder="Add a description..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 resize-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Priority</label>
                  <Select
                    value={watch('priority')}
                    onChange={(v) => setValue('priority', v as TaskPriority)}
                    options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Domain</label>
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
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Deadline</label>
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
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsEditing(false)} className="text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
                  Cancel
                </button>
                <Button type="submit" loading={isSubmitting}>Save Changes</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col min-h-full">

              {/* ── Progress track ── */}
              {(() => {
                // Prefer project domain (source of truth) over task's stored domain
                const taskDomain = ((project?.domain || task.domain) as TaskDomain) || 'DEVELOPMENT'
                const STAGES = DOMAIN_STATUSES[taskDomain] || DOMAIN_STATUSES['DEVELOPMENT']
                const STAGE_CLR: Record<string, string> = {
                  TODO: '#f59e0b', IN_PROGRESS: '#3b82f6', DEVELOPED: '#8b5cf6', CODE_REVIEW: '#a855f7',
                  TESTING: '#f97316', TESTED: '#14b8a6', DEBUGGING: '#ef4444', FINAL_TESTING: '#ec4899',
                  WIREFRAME: '#64748b', DESIGN: '#6366f1', REVIEW: '#06b6d4', REVISION: '#f43f5e', APPROVED: '#10b981',
                  PLANNING: '#6366f1', EXECUTION: '#3b82f6',
                  RESEARCH: '#8b5cf6', ANALYSIS: '#14b8a6', DOCUMENTATION: '#f97316',
                  DONE: '#10b981',
                }
                const currentIdx = STAGES.indexOf(task.status)
                const pct = getStatusProgress(task.status, taskDomain)
                return (
                  <div className="mb-5 rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-semibold text-gray-500">Progress</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: STAGE_CLR[task.status] }}>{pct}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {STAGES.map((s, i) => (
                        <div key={s} className="flex-1 h-[5px] rounded-full overflow-hidden bg-gray-200">
                          {i <= currentIdx && (
                            <div className="h-full w-full rounded-full" style={{ backgroundColor: STAGE_CLR[task.status] }} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-400">To Do</span>
                      <span className="text-[10px] font-medium" style={{ color: STAGE_CLR[task.status] }}>{TASK_STATUS_LABEL[task.status]}</span>
                      <span className="text-[10px] text-gray-400">Done</span>
                    </div>
                  </div>
                )
              })()}

              {/* ── Title + Status + Priority ── */}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-gray-900 leading-snug">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-gray-500 leading-relaxed mt-2 whitespace-pre-wrap">{task.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {isAssigned ? (
                    <Select
                      value={task.status}
                      onChange={(v) => handleStatusChange(v as TaskStatus)}
                      disabled={statusUpdating}
                      options={getStatusOptions(((project?.domain || task.domain) as TaskDomain) || 'DEVELOPMENT')}
                      className="w-48"
                    />
                  ) : (
                    <Badge variant={task.status}>{TASK_STATUS_LABEL[task.status]}</Badge>
                  )}
                  <Badge variant={task.priority}>{task.priority}</Badge>
                  {isOverdue && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md ring-1 ring-inset ring-red-200">OVERDUE</span>
                  )}
                </div>
              </div>

              {/* ── Two-column: Assignees + Details ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5 pb-5 border-b border-gray-100">
                {/* Assignees */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned To</p>
                  {task.assignedTo && task.assignedTo.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {task.assignedTo.map((userId) => (
                        <div key={userId} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <Avatar url={resolveAvatar(userId)} name={resolveName(userId)} size="sm" />
                            <span className="text-[13px] font-medium text-gray-800">{resolveName(userId)}</span>
                          </div>
                          {permissions.canAssignTask && (
                            <button onClick={() => handleUnassign(userId)} className="text-gray-200 hover:text-red-500 transition-colors" title="Remove">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-300 italic">No one assigned</p>
                  )}
                  {permissions.canAssignTask && (
                    showAssignInput ? (
                      <div className="mt-2 space-y-2">
                        {availableMembers.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">All members assigned.</p>
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
                          <button onClick={() => { setShowAssignInput(false); setSelectedAssignee('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAssignInput(true)} className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Add assignee
                      </button>
                    )
                  )}
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Details</p>
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <div>
                      <p className="text-[10px] text-gray-400">Deadline</p>
                      <p className={`text-[13px] font-medium ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                        {task.deadline
                          ? `${new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(task.deadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                          : '—'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <div>
                      <p className="text-[10px] text-gray-400">Created by</p>
                      <p className="text-[13px] font-medium text-gray-800">{resolveName(task.createdBy)}</p>
                    </div>
                  </div>
                  {task.assignedBy && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <div>
                        <p className="text-[10px] text-gray-400">Assigned by</p>
                        <p className="text-[13px] font-medium text-gray-800">{resolveName(task.assignedBy)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="text-[10px] text-gray-400">Created</p>
                      <p className="text-[13px] font-medium text-gray-800">{new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Updates / Comments ── */}
              <div className="flex-1 flex flex-col">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Updates {comments && comments.length > 0 && <span className="text-indigo-500">({comments.length})</span>}
                </p>

                {comments && comments.length > 0 ? (
                  <div className="space-y-3 mb-4 flex-1">
                    {comments.map((comment) => (
                      <div key={comment.commentId} className="flex gap-2.5">
                        <Avatar url={resolveAvatar(comment.authorId)} name={resolveName(comment.authorId)} size="sm" />
                        <div className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px] font-bold text-gray-800">{resolveName(comment.authorId)}</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-gray-300 mb-4 flex-1">No updates yet.</p>
                )}

                {canComment && (
                  <div className="flex gap-2 items-start">
                    <textarea
                      rows={1}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an update..."
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13px] placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/40 focus:bg-white resize-none transition-all"
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
