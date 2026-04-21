'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateTask } from '@/lib/hooks/useTasks'
import { useProject } from '@/lib/hooks/useProjects'
import { useAutosaveDraft } from '@/lib/hooks/useAutosaveDraft'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DraftRestoreBanner } from '@/components/ui/DraftRestoreBanner'
import type { TaskPriority } from '@/types/task'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { UserMultiSelect } from '@/components/ui/UserSelect'
import { getLocalToday } from '@/lib/utils/date'

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

const inputClass = "w-full rounded-lg border border-border/80 bg-card px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none transition-all hover:border-border placeholder:text-muted-foreground/70"

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
    mode: 'onTouched',
  })

  const currentPriority = watch('priority')
  const members = project?.members ?? []

  // Default deadline time honors the tenant's working-hours start (#15) so
  // a 9-to-5 org doesn't default to some other team's morning.
  const { current: tenant } = useTenant()
  const defaultDeadlineTime = tenant?.settings?.workingHoursStart || '09:00'

  const todayLocal = getLocalToday()

  // Draft key is scoped per-project so switching projects doesn't leak
  // descriptions across unrelated workspaces.
  const descriptionDraftKey = `create-task:${projectId}:description`
  const description = watch('description') ?? ''
  const draft = useAutosaveDraft(descriptionDraftKey, description, {
    enabled: isOpen,
  })
  const pendingRestore = draft.pendingRestore
  useEffect(() => {
    // Clear the banner on close so reopening doesn't keep offering an
    // already-restored / already-dismissed draft forever.
    if (!isOpen) draft.dismissRestore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const selectAll = () => setSelectedAssignees(members.map((m) => m.userId))
  const clearAll = () => setSelectedAssignees([])

  const onSubmit = async (values: FormValues) => {
    if (!values.deadlineDate) return
    const time = values.deadlineTime || defaultDeadlineTime
    const deadlineIso = `${values.deadlineDate}T${time}`
    // Last-chance validation — UI's `min` prop can be bypassed via keyboard
    // or pasted input. Compare the combined date+time to now.
    if (new Date(deadlineIso).getTime() < Date.now()) {
      alert('Deadline cannot be in the past. Please pick a later date or time.')
      return
    }
    await createTask.mutateAsync({
      title: values.title,
      description: values.description || undefined,
      status: 'TODO',
      priority: values.priority,
      deadline: deadlineIso,
      assignedTo: selectedAssignees.length > 0 ? selectedAssignees : undefined,
    })
    draft.clear()
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

        {pendingRestore && pendingRestore.value.trim() && (
          <DraftRestoreBanner
            savedAt={pendingRestore.savedAt}
            onRestore={() => {
              setValue('description', pendingRestore.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
              draft.dismissRestore()
            }}
            onDismiss={draft.dismissRestore}
            entityLabel="task description"
          />
        )}

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
          <input
            placeholder="What needs to be done?"
            className={`${inputClass} ${errors.title ? 'border-red-300 bg-red-50/50' : ''}`}
            {...register('title', { required: 'Title is required', minLength: { value: 2, message: 'At least 2 characters' } })}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description <span className="text-muted-foreground/50">(optional)</span></label>
          <textarea rows={2} placeholder="Add more details..." className={`${inputClass} resize-none`} {...register('description')} />
        </div>

        {/* Priority + Estimated Time */}
        {/* Priority */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
          <div className="flex gap-1.5">
            {([
              { value: 'LOW' as const, label: 'Low', active: 'bg-slate-200 border-slate-500 text-slate-800 ring-2 ring-slate-300', idle: 'bg-card border-slate-200 text-slate-400' },
              { value: 'MEDIUM' as const, label: 'Med', active: 'bg-amber-200 border-amber-500 text-amber-800 ring-2 ring-amber-300', idle: 'bg-card border-amber-200 text-amber-400' },
              { value: 'HIGH' as const, label: 'High', active: 'bg-red-200 border-red-500 text-red-800 ring-2 ring-red-300', idle: 'bg-card border-red-200 text-red-400' },
            ]).map((p) => (
              <label key={p.value} className="flex-1 cursor-pointer">
                <input type="radio" value={p.value} {...register('priority')} className="sr-only" />
                <div className={`text-center py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                  currentPriority === p.value ? p.active : p.idle + ' hover:border-border'
                }`}>{p.label}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Deadline</label>
          <div className="grid grid-cols-2 gap-3 stagger-up">
            <DatePicker
              value={watch('deadlineDate') || ''}
              onChange={(v) => setValue('deadlineDate', v, { shouldValidate: true })}
              min={todayLocal}
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
            <label className="text-xs font-medium text-muted-foreground">
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
            <div className="rounded-lg border-2 border-dashed border-border/80 py-3 text-center">
              <p className="text-xs text-muted-foreground/70">No project members yet</p>
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

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Create Task</Button>
        </div>
      </form>
    </Modal>
  )
}
