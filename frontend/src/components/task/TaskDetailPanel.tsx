'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useUpdateTask, useDeleteTask, useAssignTask } from '@/lib/hooks/useTasks'
import { useComments, useCreateComment } from '@/lib/hooks/useComments'
import { useProject } from '@/lib/hooks/useProjects'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import type { Permissions } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
  estimatedHours: string
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

  // Build userId -> name lookup from project members
  const members = project?.members ?? []
  const nameMap = new Map<string, string>()
  for (const m of members) {
    nameMap.set(m.userId, m.user?.name || m.user?.email || m.userId)
  }
  // Also add current user
  if (user) nameMap.set(user.userId, user.name || user.email)

  const resolveName = (userId: string) => nameMap.get(userId) || userId

  const {
    register,
    handleSubmit,
    reset,
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
        estimatedHours: task.estimatedHours ? String(task.estimatedHours) : '',
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
    const estHours = values.estimatedHours ? parseFloat(values.estimatedHours) : undefined
    await updateTask.mutateAsync({
      taskId: task.taskId,
      data: {
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        deadline: values.deadline || undefined,
        estimatedHours: estHours,
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
      await updateTask.mutateAsync({
        taskId: task.taskId,
        data: { status: newStatus },
      })
    } finally {
      setStatusUpdating(false)
    }
  }

  const isAssigned = task.assignedTo?.includes(user?.userId ?? '')
  const isOwnerOrAdmin = user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const canComment = isAssigned || isOwnerOrAdmin

  // Members not yet assigned to this task (for the assign dropdown)
  const assignedSet = new Set(task.assignedTo ?? [])
  const availableMembers = members.filter((m) => !assignedSet.has(m.userId))

  const statusLabel: Record<TaskStatus, string> = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done',
  }

  const priorityLabel: Record<TaskPriority, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-gray-50 shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 bg-white z-10 border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close panel"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-gray-900">Task Details</h2>
          </div>
          <div className="flex items-center gap-2">
            {permissions.canUpdateTask && !isEditing && (
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
            {permissions.canDeleteTask && (
              <Button size="sm" variant="danger" onClick={handleDelete} loading={deleteTask.isPending}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 px-6 py-5">
          {isEditing ? (
            <form onSubmit={handleSubmit(handleSave)} className="flex flex-col gap-4">
              <Input
                label="Title"
                error={errors.title?.message}
                {...register('title', { required: 'Title is required' })}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={4}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  {...register('description')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    {...register('status')}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <select
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    {...register('priority')}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <Input
                label="Deadline"
                type="datetime-local"
                {...register('deadline')}
              />
              <Input
                label="Estimated Hours"
                type="number"
                {...register('estimatedHours')}
              />
              {updateTask.error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {updateTask.error instanceof Error ? updateTask.error.message : 'Update failed'}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Title + Status Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{task.title}</h3>
                <div className="flex items-center gap-2 mb-3">
                  {permissions.canUpdateStatus && isAssigned && !permissions.canUpdateTask ? (
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                      disabled={statusUpdating}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  ) : (
                    <Badge variant={task.status}>{statusLabel[task.status]}</Badge>
                  )}
                  <Badge variant={task.priority}>{priorityLabel[task.priority]}</Badge>
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                )}
              </div>

              {/* Assignees Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Assigned To</p>
                {task.assignedTo && task.assignedTo.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {task.assignedTo.map((userId) => (
                      <div key={userId} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">{resolveName(userId).charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{resolveName(userId)}</span>
                        </div>
                        {permissions.canAssignTask && (
                          <button
                            onClick={() => handleUnassign(userId)}
                            className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No one assigned yet</p>
                )}
              </div>

              {/* Details Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Deadline</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(task.deadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {task.estimatedHours != null && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Estimated</p>
                      <p className="text-sm font-medium text-gray-900">{task.estimatedHours} hours</p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Created By</p>
                    <p className="text-sm font-medium text-gray-900">{resolveName(task.createdBy)}</p>
                  </div>
                  {task.assignedBy && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Assigned By</p>
                      <p className="text-sm font-medium text-gray-900">{resolveName(task.assignedBy)}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Assign section */}
              {/* Assign section */}
              {permissions.canAssignTask && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  {showAssignInput ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Add Assignee</p>
                      {availableMembers.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">All members are already assigned.</p>
                      ) : (
                        <select
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                        >
                          <option value="">-- Select a member --</option>
                          {availableMembers.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.user?.name || m.user?.email || m.userId} ({m.projectRole})
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAssign} loading={assignTask.isPending} disabled={!selectedAssignee}>
                          Add
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => { setShowAssignInput(false); setSelectedAssignee('') }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAssignInput(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Assignee
                    </button>
                  )}
                </div>
              )}

              {/* Progress Comments */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Progress Updates</p>

                {comments && comments.length > 0 ? (
                  <div className="flex flex-col gap-3 mb-4">
                    {comments.map((comment) => (
                      <div key={comment.commentId} className="rounded-xl bg-gray-50 p-3.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <span className="text-white text-[10px] font-bold">{resolveName(comment.authorId).charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-900">{resolveName(comment.authorId)}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {new Date(comment.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-4">No progress updates yet.</p>
                )}

                {canComment && (
                  <div className="flex gap-2 items-start">
                    <textarea
                      rows={1}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an update..."
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none transition-all"
                    />
                    <Button
                      size="sm"
                      onClick={handlePostComment}
                      loading={createComment.isPending}
                      disabled={!commentText.trim()}
                    >
                      Post
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
