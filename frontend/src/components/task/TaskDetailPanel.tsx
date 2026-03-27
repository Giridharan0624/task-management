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
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
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
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close panel"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-6">
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
            <div className="flex flex-col gap-6">
              {/* Title */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Title</p>
                <p className="text-base font-semibold text-gray-900">{task.title}</p>
              </div>

              {/* Status + Priority */}
              <div className="flex items-center gap-3">
                {permissions.canUpdateStatus && isAssigned && !permissions.canUpdateTask ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    disabled={statusUpdating}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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

              {/* Description */}
              {task.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Assigned To</p>
                  {task.assignedTo && task.assignedTo.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {task.assignedTo.map((userId) => (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-indigo-700"
                        >
                          {resolveName(userId)}
                          {permissions.canAssignTask && (
                            <button
                              onClick={() => handleUnassign(userId)}
                              className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 transition-colors"
                              title="Remove assignee"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Unassigned</p>
                  )}
                </div>
                {task.assignedBy && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Assigned By</p>
                    <p className="text-sm text-gray-700">{resolveName(task.assignedBy)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Created By</p>
                  <p className="text-sm text-gray-700">{resolveName(task.createdBy)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Deadline</p>
                  <p className="text-sm text-gray-700">
                    {new Date(task.deadline).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Created At</p>
                  <p className="text-sm text-gray-700">
                    {new Date(task.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Assign section */}
              {permissions.canAssignTask && (
                <div className="border-t border-gray-100 pt-4">
                  {showAssignInput ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">Add Assignee</label>
                      {availableMembers.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">All members are already assigned.</p>
                      ) : (
                        <select
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setShowAssignInput(false); setSelectedAssignee('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowAssignInput(true)}
                    >
                      Assign Task
                    </Button>
                  )}
                </div>
              )}

              {/* Progress Comments */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Progress Updates</p>

                {comments && comments.length > 0 ? (
                  <div className="flex flex-col gap-3 mb-4">
                    {comments.map((comment) => (
                      <div key={comment.commentId} className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-indigo-700">{resolveName(comment.authorId)}</span>
                          <span className="text-xs text-gray-400">
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
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Post a progress update..."
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handlePostComment}
                        loading={createComment.isPending}
                        disabled={!commentText.trim()}
                      >
                        Post Update
                      </Button>
                    </div>
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
