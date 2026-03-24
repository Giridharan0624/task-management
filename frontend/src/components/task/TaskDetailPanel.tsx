'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useUpdateTask, useDeleteTask, useAssignTask } from '@/lib/hooks/useTasks'
import type { Task, TaskStatus, TaskPriority } from '@/types/task'
import type { Permissions } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface TaskDetailPanelProps {
  task: Task | null
  boardId: string
  permissions: Permissions
  onClose: () => void
}

interface EditFormValues {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
}

export function TaskDetailPanel({ task, boardId, permissions, onClose }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask(boardId)
  const deleteTask = useDeleteTask(boardId)
  const assignTask = useAssignTask(boardId)
  const [isEditing, setIsEditing] = useState(false)
  const [assigneeInput, setAssigneeInput] = useState('')
  const [showAssignInput, setShowAssignInput] = useState(false)

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
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      })
      setIsEditing(false)
      setShowAssignInput(false)
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
        dueDate: values.dueDate || undefined,
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
    if (!assigneeInput.trim()) return
    await assignTask.mutateAsync({ taskId: task.taskId, assignedTo: assigneeInput.trim() })
    setShowAssignInput(false)
    setAssigneeInput('')
  }

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
              <Input label="Due Date" type="date" {...register('dueDate')} />
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

              {/* Badges */}
              <div className="flex gap-2">
                <Badge variant={task.status}>{statusLabel[task.status]}</Badge>
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
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Assigned To</p>
                  <p className="text-sm text-gray-700">{task.assignedTo ?? 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Created By</p>
                  <p className="text-sm text-gray-700">{task.createdBy}</p>
                </div>
                {task.dueDate && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Due Date</p>
                    <p className="text-sm text-gray-700">
                      {new Date(task.dueDate).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
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
              {permissions.canUpdateTask && (
                <div className="border-t border-gray-100 pt-4">
                  {showAssignInput ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={assigneeInput}
                        onChange={(e) => setAssigneeInput(e.target.value)}
                        placeholder="Enter user ID to assign"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button size="sm" onClick={handleAssign} loading={assignTask.isPending}>
                        Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setShowAssignInput(false); setAssigneeInput('') }}
                      >
                        Cancel
                      </Button>
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
            </div>
          )}
        </div>
      </div>
    </>
  )
}
