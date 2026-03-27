'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateTask } from '@/lib/hooks/useTasks'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { TaskStatus, TaskPriority } from '@/types/task'

interface CreateTaskModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface FormValues {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  deadline: string
}

export function CreateTaskModal({ projectId, isOpen, onClose }: CreateTaskModalProps) {
  const createTask = useCreateTask(projectId)
  const [assigneeInputs, setAssigneeInputs] = useState<string[]>([''])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      status: 'TODO',
      priority: 'MEDIUM',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const assignedTo = assigneeInputs.map((s) => s.trim()).filter(Boolean)
    await createTask.mutateAsync({
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      deadline: values.deadline,
      assignedTo: assignedTo.length > 0 ? assignedTo : undefined,
    })
    reset()
    setAssigneeInputs([''])
    onClose()
  }

  const handleClose = () => {
    reset()
    setAssigneeInputs([''])
    onClose()
  }

  const addAssigneeField = () => {
    setAssigneeInputs((prev) => [...prev, ''])
  }

  const removeAssigneeField = (index: number) => {
    setAssigneeInputs((prev) => prev.filter((_, i) => i !== index))
  }

  const updateAssignee = (index: number, value: string) => {
    setAssigneeInputs((prev) => prev.map((v, i) => (i === index ? value : v)))
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
          error={errors.deadline?.message}
          {...register('deadline', { required: 'Deadline is required' })}
        />

        {/* Multi-assign */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Assign To</label>
          {assigneeInputs.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => updateAssignee(index, e.target.value)}
                placeholder="Enter user ID"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {assigneeInputs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAssigneeField(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAssigneeField}
            className="text-sm text-blue-600 hover:text-blue-800 self-start"
          >
            + Add another assignee
          </button>
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
