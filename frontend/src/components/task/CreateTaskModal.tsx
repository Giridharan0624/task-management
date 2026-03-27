'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateTask } from '@/lib/hooks/useTasks'
import { useProject } from '@/lib/hooks/useProjects'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { TaskPriority } from '@/types/task'

interface CreateTaskModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface FormValues {
  title: string
  description: string
  priority: TaskPriority
  deadline: string
}

export function CreateTaskModal({ projectId, isOpen, onClose }: CreateTaskModalProps) {
  const createTask = useCreateTask(projectId)
  const { data: project } = useProject(projectId)
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      priority: 'MEDIUM',
    },
  })

  const members = project?.members ?? []

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const onSubmit = async (values: FormValues) => {
    await createTask.mutateAsync({
      title: values.title,
      description: values.description || undefined,
      status: 'TODO',
      priority: values.priority,
      deadline: values.deadline,
      assignedTo: selectedAssignees.length > 0 ? selectedAssignees : undefined,
    })
    reset()
    setSelectedAssignees([])
    onClose()
  }

  const handleClose = () => {
    reset()
    setSelectedAssignees([])
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Task">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Title"
          placeholder="Task title"
          error={errors.title?.message}
          {...register('title', {
            required: 'Title is required',
            minLength: { value: 2, message: 'Title must be at least 2 characters' },
          })}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Description (optional)</label>
          <textarea
            rows={3}
            placeholder="Describe the task..."
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            {...register('description')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

          <Input
            label="Deadline"
            type="datetime-local"
            error={errors.deadline?.message}
            {...register('deadline', { required: 'Deadline is required' })}
          />
        </div>

        {/* Assign to project members */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Assign To ({selectedAssignees.length} selected)
          </label>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No project members yet. Add members first.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {members.map((m) => {
                const isSelected = selectedAssignees.includes(m.userId)
                return (
                  <label
                    key={m.userId}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAssignee(m.userId)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 text-xs font-medium">
                          {(m.user?.name || m.user?.email || m.userId).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900 truncate">
                        {m.user?.name || m.user?.email || m.userId}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{m.projectRole}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {createTask.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {createTask.error instanceof Error
              ? createTask.error.message
              : 'Failed to create task'}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  )
}
