'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateProject } from '@/lib/hooks/useProjects'
import { useUsers } from '@/lib/hooks/useUsers'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/AvatarUpload'
import { UserSelect } from '@/components/ui/UserSelect'
import { Select } from '@/components/ui/Select'
import { DOMAIN_OPTIONS } from '@/types/task'
import type { TaskDomain } from '@/types/task'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

interface FormValues {
  name: string
  description: string
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const createProject = useCreateProject()
  const { data: allUsers } = useUsers()
  const [teamLeadId, setTeamLeadId] = useState('')
  const [projectManagerId, setProjectManagerId] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [domain, setDomain] = useState<TaskDomain>('DEVELOPMENT')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onTouched' })

  // Filter to non-OWNER users for team selection
  const availableUsers = (allUsers ?? []).filter((u) => u.systemRole !== 'OWNER')

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const onSubmit = async (values: FormValues) => {
    await createProject.mutateAsync({
      name: values.name,
      description: values.description || undefined,
      teamLeadId: teamLeadId || undefined,
      projectManagerId: projectManagerId || undefined,
      memberIds: selectedMembers.length > 0 ? selectedMembers : undefined,
      domain,
    })
    reset()
    setTeamLeadId('')
    setProjectManagerId('')
    setSelectedMembers([])
    setDomain('DEVELOPMENT')
    onClose()
  }

  const handleClose = () => {
    reset()
    setTeamLeadId('')
    setProjectManagerId('')
    setSelectedMembers([])
    setDomain('DEVELOPMENT')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Project">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Project Name"
          placeholder="e.g. Product Roadmap"
          error={errors.name?.message}
          {...register('name', {
            required: 'Project name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground/85">Description (optional)</label>
          <textarea
            rows={2}
            placeholder="What is this project about?"
            className="block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            {...register('description')}
          />
        </div>

        {/* Domain Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground/85">Domain</label>
          <Select value={domain} onChange={v => setDomain(v as TaskDomain)}
            options={DOMAIN_OPTIONS.map(d => ({ value: d.value, label: d.label }))} />
          <p className="text-[10px] text-muted-foreground/70">Determines the task pipeline steps for this project</p>
        </div>

        {/* Team Lead Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground/85">Team Lead</label>
          <UserSelect
            users={availableUsers.map((u) => ({ userId: u.userId, name: u.name || u.email, email: u.email, avatarUrl: u.avatarUrl, extra: u.systemRole }))}
            value={teamLeadId}
            onChange={setTeamLeadId}
            placeholder="Select a Team Lead"
          />
        </div>

        {/* Project Manager Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground/85">Project Manager</label>
          <UserSelect
            users={availableUsers
              .filter((u) => u.userId !== teamLeadId)
              .map((u) => ({ userId: u.userId, name: u.name || u.email, email: u.email, avatarUrl: u.avatarUrl, extra: u.systemRole }))}
            value={projectManagerId}
            onChange={setProjectManagerId}
            placeholder="Select a Project Manager"
          />
        </div>

        {/* Team Members Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground/85">
            Team Members ({selectedMembers.length} selected)
          </label>
          {availableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No users available. Create users first.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border/80 divide-y divide-border/80">
              {availableUsers
                .filter((u) => u.userId !== teamLeadId && u.userId !== projectManagerId)
                .map((u) => {
                  const isSelected = selectedMembers.includes(u.userId)
                  return (
                    <label
                      key={u.userId}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors ${
                        isSelected ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(u.userId)}
                        className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Avatar url={u.avatarUrl} name={u.name || u.email} size="sm" />
                        <span className="text-sm text-foreground truncate">{u.name || u.email}</span>
                        <span className="text-xs text-muted-foreground/70 ml-auto flex-shrink-0">{u.systemRole}</span>
                      </div>
                    </label>
                  )
                })}
            </div>
          )}
        </div>

        {createProject.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {createProject.error instanceof Error
              ? createProject.error.message
              : 'Failed to create project'}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
