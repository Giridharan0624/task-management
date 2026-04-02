'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateTask } from '@/lib/hooks/useTasks'
import { useProject } from '@/lib/hooks/useProjects'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { TaskPriority } from '@/types/task'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { UserMultiSelect } from '@/components/ui/UserSelect'

interface CreateTaskModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface FormValues {
  title: string
  description: string
  priority: TaskPriority
  deadlineDate: string
  deadlineTime: string
}

const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none transition-all hover:border-gray-300 placeholder:text-gray-400"

export function CreateTaskModal({ projectId, isOpen, onClose }: CreateTaskModalProps) {
  const createTask = useCreateTask(projectId)
  const { data: project } = useProject(projectId)
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { priority: 'MEDIUM' },
  })

  const currentPriority = watch('priority')
  const members = project?.members ?? []

  const selectAll = () => setSelectedAssignees(members.map((m) => m.userId))
  const clearAll = () => setSelectedAssignees([])

  const onSubmit = async (values: FormValues) => {
    const deadline = `${values.deadlineDate}T${values.deadlineTime || '09:00'}`
    await createTask.mutateAsync({
      title: values.title,
      description: values.description || undefined,
      status: 'TODO',
      priority: values.priority,
      deadline,
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Task" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
          <input
            placeholder="What needs to be done?"
            className={`${inputClass} ${errors.title ? 'border-red-300 bg-red-50/50' : ''}`}
            {...register('title', { required: 'Title is required', minLength: { value: 2, message: 'At least 2 characters' } })}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Description <span className="text-gray-300">(optional)</span></label>
          <textarea rows={2} placeholder="Add more details..." className={`${inputClass} resize-none`} {...register('description')} />
        </div>

        {/* Priority + Estimated Time */}
        {/* Priority */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label>
          <div className="flex gap-1.5">
            {([
              { value: 'LOW' as const, label: 'Low', active: 'bg-slate-200 border-slate-500 text-slate-800 ring-2 ring-slate-300', idle: 'bg-white border-slate-200 text-slate-400' },
              { value: 'MEDIUM' as const, label: 'Med', active: 'bg-amber-200 border-amber-500 text-amber-800 ring-2 ring-amber-300', idle: 'bg-white border-amber-200 text-amber-400' },
              { value: 'HIGH' as const, label: 'High', active: 'bg-red-200 border-red-500 text-red-800 ring-2 ring-red-300', idle: 'bg-white border-red-200 text-red-400' },
            ]).map((p) => (
              <label key={p.value} className="flex-1 cursor-pointer">
                <input type="radio" value={p.value} {...register('priority')} className="sr-only" />
                <div className={`text-center py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                  currentPriority === p.value ? p.active : p.idle + ' hover:border-gray-300'
                }`}>{p.label}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Deadline</label>
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              value={watch('deadlineDate') || ''}
              onChange={(v) => setValue('deadlineDate', v, { shouldValidate: true })}
              min={new Date().toISOString().slice(0, 10)}
            />
            <TimePicker
              value={watch('deadlineTime') || ''}
              onChange={(v) => setValue('deadlineTime', v, { shouldValidate: true })}
              placeholder="Select time"
            />
          </div>
          {(errors.deadlineDate || errors.deadlineTime) && (
            <p className="text-xs text-red-500 mt-1">{errors.deadlineDate?.message || errors.deadlineTime?.message}</p>
          )}
        </div>

        {/* Assign Members */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">
              Assign To
              {selectedAssignees.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {selectedAssignees.length}
                </span>
              )}
            </label>
            {members.length > 0 && (
              <button type="button" onClick={selectedAssignees.length === members.length ? clearAll : selectAll}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold">
                {selectedAssignees.length === members.length ? 'Clear all' : 'Select all'}
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-3 text-center">
              <p className="text-xs text-gray-400">No project members yet</p>
            </div>
          ) : (
            <UserMultiSelect
              users={members.map((m) => ({
                userId: m.userId,
                name: m.user?.name || m.user?.email || m.userId,
                email: m.user?.email || '',
                avatarUrl: m.user?.avatarUrl,
                extra: m.projectRole === 'TEAM_LEAD' ? 'Lead' : m.projectRole === 'PROJECT_MANAGER' ? 'PM' : m.projectRole,
              }))}
              selected={selectedAssignees}
              onChange={setSelectedAssignees}
              placeholder="Search members..."
            />
          )}
        </div>

        {createTask.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {createTask.error instanceof Error ? createTask.error.message : 'Failed to create task'}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create Task</Button>
        </div>
      </form>
    </Modal>
  )
}
