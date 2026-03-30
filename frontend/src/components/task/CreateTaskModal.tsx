'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateTask } from '@/lib/hooks/useTasks'
import { useProject } from '@/lib/hooks/useProjects'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/AvatarUpload'
import type { TaskPriority } from '@/types/task'
import { DatePicker } from '@/components/ui/DatePicker'

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
  estHours: string
  estMinutes: string
}

const priorityConfig = [
  { value: 'LOW' as const, label: 'Low', icon: '!', bg: 'bg-slate-50', border: 'border-slate-200', activeBg: 'bg-slate-100', activeBorder: 'border-slate-500', text: 'text-slate-600', ring: 'ring-slate-400' },
  { value: 'MEDIUM' as const, label: 'Medium', icon: '!!', bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-100', activeBorder: 'border-amber-500', text: 'text-amber-700', ring: 'ring-amber-400' },
  { value: 'HIGH' as const, label: 'High', icon: '!!!', bg: 'bg-red-50', border: 'border-red-200', activeBg: 'bg-red-100', activeBorder: 'border-red-500', text: 'text-red-700', ring: 'ring-red-400' },
]

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
    defaultValues: {
      priority: 'MEDIUM',
    },
  })

  const currentPriority = watch('priority')
  const members = project?.members ?? []

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const selectAll = () => setSelectedAssignees(members.map((m) => m.userId))
  const clearAll = () => setSelectedAssignees([])

  const onSubmit = async (values: FormValues) => {
    const deadline = `${values.deadlineDate}T${values.deadlineTime}`
    const h = parseInt(values.estHours || '0', 10)
    const m = parseInt(values.estMinutes || '0', 10)
    const estHours = (h || m) ? h + m / 60 : undefined
    await createTask.mutateAsync({
      title: values.title,
      description: values.description || undefined,
      status: 'TODO',
      priority: values.priority,
      deadline,
      estimatedHours: estHours,
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-800">Title</label>
          <input
            placeholder="What needs to be done?"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
              errors.title ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
            }`}
            {...register('title', {
              required: 'Title is required',
              minLength: { value: 2, message: 'At least 2 characters' },
            })}
          />
          {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-800">
            Description <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Add more details..."
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all"
            {...register('description')}
          />
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-800">Priority</label>
          <div className="grid grid-cols-3 gap-2">
            {priorityConfig.map((p) => {
              const isActive = currentPriority === p.value
              return (
                <label key={p.value} className="cursor-pointer">
                  <input type="radio" value={p.value} {...register('priority')} className="sr-only" />
                  <div className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all ${
                    isActive
                      ? `${p.activeBg} ${p.activeBorder} ring-1 ${p.ring}`
                      : `${p.bg} ${p.border} hover:border-gray-300`
                  }`}>
                    <span className={`text-lg font-bold ${p.text}`}>{p.icon}</span>
                    <span className={`text-xs font-medium ${isActive ? p.text : 'text-gray-500'}`}>{p.label}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Estimated Time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-800">
            Estimated Time <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input type="number" min="0" max="999" placeholder="0" {...register('estHours')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-14 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hours</span>
            </div>
            <div className="relative">
              <input type="number" min="0" max="59" placeholder="0" {...register('estMinutes')}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-14 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-800">Deadline</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <DatePicker
                value={watch('deadlineDate') || ''}
                onChange={(v) => { register('deadlineDate', { required: 'Date is required' }); setValue('deadlineDate', v, { shouldValidate: true }) }}
                required
              />
            </div>
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                type="time"
                className={`w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                  errors.deadlineTime ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                {...register('deadlineTime', { required: 'Time is required' })}
              />
            </div>
          </div>
          {(errors.deadlineDate || errors.deadlineTime) && (
            <p className="text-xs text-red-500">{errors.deadlineDate?.message || errors.deadlineTime?.message}</p>
          )}
        </div>

        {/* Assign Members */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-800">
              Assign To
              {selectedAssignees.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                  {selectedAssignees.length}
                </span>
              )}
            </label>
            {members.length > 0 && (
              <button
                type="button"
                onClick={selectedAssignees.length === members.length ? clearAll : selectAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {selectedAssignees.length === members.length ? 'Clear all' : 'Select all'}
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-4 text-center">
              <p className="text-sm text-gray-400">No project members yet</p>
            </div>
          ) : (
            <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
              {members.map((m) => {
                const isSelected = selectedAssignees.includes(m.userId)
                const name = m.user?.name || m.user?.email || m.userId
                return (
                  <label
                    key={m.userId}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all ${
                      isSelected ? 'bg-indigo-50/70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-5 w-5 rounded-md border-2 transition-all ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAssignee(m.userId)}
                      className="sr-only"
                    />
                    <Avatar url={m.user?.avatarUrl} name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm truncate block ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {name}
                      </span>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                      m.projectRole === 'TEAM_LEAD' ? 'bg-orange-100 text-orange-600' :
                      m.projectRole === 'ADMIN' ? 'bg-purple-100 text-purple-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {m.projectRole === 'TEAM_LEAD' ? 'Lead' : m.projectRole}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {createTask.error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {createTask.error instanceof Error ? createTask.error.message : 'Failed to create task'}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
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
