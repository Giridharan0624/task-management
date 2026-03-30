'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useUpdateTask, useDeleteTask, useAssignTask } from '@/lib/hooks/useTasks'
import { useComments, useCreateComment } from '@/lib/hooks/useComments'
import { useProject } from '@/lib/hooks/useProjects'
import { useAdmins } from '@/lib/hooks/useUsers'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import type { Permissions } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Select } from '@/components/ui/Select'
import { UserSelect } from '@/components/ui/UserSelect'

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

  const members = project?.members ?? []
  const nameMap = new Map<string, string>()
  for (const m of members) {
    nameMap.set(m.userId, m.user?.name || m.user?.email || m.userId)
  }
  if (user) nameMap.set(user.userId, user.name || user.email)
  for (const a of admins ?? []) {
    if (!nameMap.has(a.userId)) nameMap.set(a.userId, a.name || a.email)
  }

  const resolveName = (userId: string) => nameMap.get(userId) || 'Unknown'

  const avatarMap = new Map<string, string | undefined>()
  for (const m of members) {
    avatarMap.set(m.userId, m.user?.avatarUrl)
  }
  const resolveAvatar = (userId: string) => avatarMap.get(userId)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>()

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        deadline: task.deadline ? task.deadline.slice(0, 16) : '',
      })
      setIsEditing(false)
      setShowAssignInput(false)
      setCommentText('')
    }
  }, [task, reset])

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
        deadline: values.deadline || undefined,
      },
    })
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return
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

  const isOverdue = task.deadline && task.status !== 'DONE' && new Date(task.deadline) < new Date()

  const panel = (
    <div className="fixed inset-0 z-[9998] overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center py-8 px-4">
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15),0_10px_30px_-8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] flex flex-col max-h-[90vh] animate-fade-in-scale"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">Task Details</h2>
          <div className="flex items-center gap-1.5">
            {permissions.canUpdateTask && !isEditing && (
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
            )}
            {permissions.canDeleteTask && (
              <Button size="sm" variant="danger" onClick={handleDelete} loading={deleteTask.isPending}>Delete</Button>
            )}
            <button onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-5 overflow-y-auto min-h-0">
          {isEditing ? (
            <form onSubmit={handleSubmit(handleSave)} className="flex flex-col gap-4">
              <Input label="Title" error={errors.title?.message} {...register('title', { required: 'Title is required' })} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Description</label>
                <textarea rows={3} className="block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 resize-none transition-all" {...register('description')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">Status</label>
                  <Select
                    value={watch('status')}
                    onChange={(v) => setValue('status', v as TaskStatus)}
                    options={[{ value: 'TODO', label: 'To Do' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'DONE', label: 'Done' }]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">Priority</label>
                  <Select
                    value={watch('priority')}
                    onChange={(v) => setValue('priority', v as TaskPriority)}
                    options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
                  />
                </div>
              </div>
              <Input label="Deadline" type="datetime-local" {...register('deadline')} />
              {updateTask.error && (
                <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {updateTask.error instanceof Error ? updateTask.error.message : 'Update failed'}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" type="button" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>Save</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-7 flex flex-col min-h-full">

              {/* Title + badges */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{task.title}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {permissions.canUpdateStatus && isAssigned && !permissions.canUpdateTask ? (
                    <Select
                      value={task.status}
                      onChange={(v) => handleStatusChange(v as TaskStatus)}
                      disabled={statusUpdating}
                      options={[{ value: 'TODO', label: 'To Do' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'DONE', label: 'Done' }]}
                      className="w-36"
                    />
                  ) : (
                    <Badge variant={task.status}>{task.status === 'IN_PROGRESS' ? 'In Progress' : task.status === 'TODO' ? 'To Do' : 'Done'}</Badge>
                  )}
                  <Badge variant={task.priority}>{task.priority}</Badge>
                  {isOverdue && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md ring-1 ring-inset ring-red-200">OVERDUE</span>
                  )}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap">{task.description}</p>
                )}
              </div>

              {/* Assignees */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned To</p>
                {task.assignedTo && task.assignedTo.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {task.assignedTo.map((userId) => (
                      <div key={userId} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar url={resolveAvatar(userId)} name={resolveName(userId)} size="sm" />
                          <span className="text-sm font-medium text-gray-900">{resolveName(userId)}</span>
                        </div>
                        {permissions.canAssignTask && (
                          <button onClick={() => handleUnassign(userId)} className="text-gray-300 hover:text-red-500 transition-colors" title="Remove">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 italic">No one assigned</p>
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
                    <button onClick={() => setShowAssignInput(true)} className="flex items-center gap-1 mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add assignee
                    </button>
                  )
                )}
              </div>

              {/* Meta grid */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Details</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Deadline</p>
                    <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {task.deadline ? (
                        <>
                          {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          <span className="text-gray-400 font-normal ml-1">
                            {new Date(task.deadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      ) : <span className="text-gray-300">No deadline</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Created by</p>
                    <p className="text-sm font-medium text-gray-900">{resolveName(task.createdBy)}</p>
                  </div>
                  {task.assignedBy && (
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Assigned by</p>
                      <p className="text-sm font-medium text-gray-900">{resolveName(task.assignedBy)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comments — grows to fill remaining space */}
              <div className="pt-2 border-t border-gray-100 flex-1 flex flex-col">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Updates {comments && comments.length > 0 && <span className="text-indigo-500">({comments.length})</span>}
                </p>

                {comments && comments.length > 0 ? (
                  <div className="space-y-2 mb-3 flex-1">
                    {comments.map((comment) => (
                      <div key={comment.commentId} className="flex gap-2.5">
                        <Avatar url={resolveAvatar(comment.authorId)} name={resolveName(comment.authorId)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-gray-900">{resolveName(comment.authorId)}</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 mb-3 flex-1">No updates yet.</p>
                )}

                {canComment && (
                  <div className="flex gap-2 items-start">
                    <textarea
                      rows={1}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an update..."
                      className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/40 focus:bg-white resize-none transition-all"
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
