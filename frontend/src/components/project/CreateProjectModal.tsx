'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AlertCircle, Check, Search, X } from 'lucide-react'

import { useCreateProject, useProjects } from '@/lib/hooks/useProjects'
import { useUsers } from '@/lib/hooks/useUsers'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/AvatarUpload'
import { UserSelect } from '@/components/ui/UserSelect'
import { Select } from '@/components/ui/Select'
import { DOMAIN_OPTIONS } from '@/types/task'
import type { TaskDomain } from '@/types/task'
import { cn } from '@/lib/utils'

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
  const { data: existingProjects } = useProjects()

  const [teamLeadId, setTeamLeadId] = useState('')
  const [projectManagerId, setProjectManagerId] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [domain, setDomain] = useState<TaskDomain>('DEVELOPMENT')
  const [memberQuery, setMemberQuery] = useState('')

  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onTouched' })

  const nameValue = watch('name') ?? ''

  // Filter out OWNER (workspace owner is implicit) — the rest of the
  // roster is selectable for any role on the project.
  const availableUsers = useMemo(
    () => (allUsers ?? []).filter((u) => u.systemRole !== 'OWNER'),
    [allUsers],
  )

  // Auto-include the picked Team Lead and Project Manager in the
  // member set so a project never ships with a lead that isn't a
  // member of it. Removing them from the member list is blocked
  // below — to deselect, the user clears the Team Lead/PM dropdown.
  const effectiveMemberIds = useMemo(() => {
    const set = new Set(selectedMembers)
    if (teamLeadId) set.add(teamLeadId)
    if (projectManagerId) set.add(projectManagerId)
    return set
  }, [selectedMembers, teamLeadId, projectManagerId])

  // Duplicate-name detection — case-insensitive trim match against
  // every existing project. Surfaces as a soft warning, not an
  // error, because two projects can legitimately share a name across
  // different domains/teams.
  const duplicateName = useMemo(() => {
    const trimmed = nameValue.trim().toLowerCase()
    if (!trimmed || !existingProjects) return null
    return existingProjects.find((p) => p.name.trim().toLowerCase() === trimmed)
      ? trimmed
      : null
  }, [nameValue, existingProjects])

  // Member list filtered by the search query. Sorted: selected
  // members surface first, then alphabetical.
  const visibleUsers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    const filtered = availableUsers.filter((u) => {
      if (!q) return true
      const name = (u.name || '').toLowerCase()
      const email = u.email.toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    return filtered.sort((a, b) => {
      const aSel = effectiveMemberIds.has(a.userId) ? 0 : 1
      const bSel = effectiveMemberIds.has(b.userId) ? 0 : 1
      if (aSel !== bSel) return aSel - bSel
      return (a.name || a.email).localeCompare(b.name || b.email)
    })
  }, [availableUsers, memberQuery, effectiveMemberIds])

  const allVisibleSelected =
    visibleUsers.length > 0 &&
    visibleUsers.every((u) => effectiveMemberIds.has(u.userId))

  const toggleMember = (userId: string) => {
    // Lead/PM can't be deselected from the member list — they're
    // pinned by the dropdowns above. Tell the user via a small visual
    // (read-only checkbox) and return.
    if (userId === teamLeadId || userId === projectManagerId) return
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    )
  }

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      // Deselect everyone visible — but preserve Lead/PM (they remain
      // pinned via their respective dropdowns).
      const visibleIds = new Set(
        visibleUsers
          .map((u) => u.userId)
          .filter((id) => id !== teamLeadId && id !== projectManagerId),
      )
      setSelectedMembers((prev) => prev.filter((id) => !visibleIds.has(id)))
    } else {
      const additions = visibleUsers
        .map((u) => u.userId)
        .filter(
          (id) =>
            id !== teamLeadId &&
            id !== projectManagerId &&
            !selectedMembers.includes(id),
        )
      setSelectedMembers((prev) => [...prev, ...additions])
    }
  }

  const resetState = () => {
    reset()
    setTeamLeadId('')
    setProjectManagerId('')
    setSelectedMembers([])
    setDomain('DEVELOPMENT')
    setMemberQuery('')
  }

  const onSubmit = async (values: FormValues) => {
    await createProject.mutateAsync({
      name: values.name,
      description: values.description || undefined,
      teamLeadId: teamLeadId || undefined,
      projectManagerId: projectManagerId || undefined,
      memberIds:
        effectiveMemberIds.size > 0 ? Array.from(effectiveMemberIds) : undefined,
      domain,
    })
    resetState()
    onClose()
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  // Cmd/Ctrl + Enter submits from anywhere inside the modal — saves a
  // trip to the bottom of a long member list.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Project"
      size="lg"
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col"
      >
        {/* Body — Modal's own DialogContent handles scroll, so this
            block only owns layout (no max-height of its own, no
            independent overflow). Avoids painting empty space below
            the footer when content is shorter than the viewport. */}
        <div className="flex flex-col gap-5">
          {/* ─── Name + duplicate hint ─── */}
          <div className="flex flex-col gap-1">
            <Input
              label="Project Name"
              placeholder="e.g. Product Roadmap"
              error={errors.name?.message}
              {...register('name', {
                required: 'Project name is required',
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              })}
            />
            {duplicateName && !errors.name && (
              <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                A project named &ldquo;{duplicateName}&rdquo; already exists. You
                can still create another with the same name.
              </p>
            )}
          </div>

          {/* ─── Description ─── */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground/85">
              Description (optional)
            </label>
            <textarea
              rows={2}
              placeholder="What is this project about?"
              className="block w-full resize-none rounded-md border border-border px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              {...register('description')}
            />
          </div>

          {/* ─── Workflow (backend identifier is still `domain`) ─── */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground/85">
              Workflow
            </label>
            <Select
              value={domain}
              onChange={(v) => setDomain(v as TaskDomain)}
              options={DOMAIN_OPTIONS.map((d) => ({
                value: d.value,
                label: d.label,
              }))}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Determines the task pipeline steps for this project.
            </p>
          </div>

          {/* ─── Team Lead / Project Manager ─── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground/85">
                Team Lead
              </label>
              <UserSelect
                users={availableUsers
                  .filter((u) => u.userId !== projectManagerId)
                  .map((u) => ({
                    userId: u.userId,
                    name: u.name || u.email,
                    email: u.email,
                    avatarUrl: u.avatarUrl,
                    extra: u.systemRole,
                  }))}
                value={teamLeadId}
                onChange={setTeamLeadId}
                placeholder="Select a Team Lead"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground/85">
                Project Manager
              </label>
              <UserSelect
                users={availableUsers
                  .filter((u) => u.userId !== teamLeadId)
                  .map((u) => ({
                    userId: u.userId,
                    name: u.name || u.email,
                    email: u.email,
                    avatarUrl: u.avatarUrl,
                    extra: u.systemRole,
                  }))}
                value={projectManagerId}
                onChange={setProjectManagerId}
                placeholder="Select a Project Manager"
              />
            </div>
          </div>

          {/* ─── Team Members — searchable, select-all, role chips ─── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/85">
                Team Members{' '}
                <span className="text-muted-foreground">
                  ({effectiveMemberIds.size} selected)
                </span>
              </label>
              {visibleUsers.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {allVisibleSelected ? 'Deselect all' : 'Select all'}
                  {memberQuery && ' (matching)'}
                </button>
              )}
            </div>

            {/* Search */}
            {availableUsers.length > 6 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-[13px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {memberQuery && (
                  <button
                    type="button"
                    onClick={() => setMemberQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {availableUsers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-sm italic text-muted-foreground">
                No users available. Create users first.
              </p>
            ) : visibleUsers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-center text-[12px] text-muted-foreground">
                No members match &ldquo;{memberQuery}&rdquo;.
              </p>
            ) : (
              <div className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/80">
                {visibleUsers.map((u) => {
                  const isLead = u.userId === teamLeadId
                  const isPM = u.userId === projectManagerId
                  const isPinned = isLead || isPM
                  const isSelected = effectiveMemberIds.has(u.userId)
                  return (
                    <label
                      key={u.userId}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 transition-colors',
                        isPinned
                          ? 'bg-primary/[0.04] cursor-default'
                          : 'cursor-pointer hover:bg-muted/40',
                        isSelected && !isPinned && 'bg-primary/[0.04]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card',
                          isPinned && 'opacity-90',
                        )}
                      >
                        {isSelected && (
                          <Check
                            className="h-3 w-3"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(u.userId)}
                        disabled={isPinned}
                        className="sr-only"
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Avatar
                          url={u.avatarUrl}
                          name={u.name || u.email}
                          size="sm"
                        />
                        <span className="truncate text-sm text-foreground">
                          {u.name || u.email}
                        </span>
                        {isLead && (
                          <span className="ml-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                            Lead
                          </span>
                        )}
                        {isPM && (
                          <span className="ml-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                            PM
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground/70">
                          {u.systemRole}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {(teamLeadId || projectManagerId) && (
              <p className="text-[10px] text-muted-foreground/80">
                Team Lead and Project Manager are added to the member list
                automatically. Clear them above to remove.
              </p>
            )}
          </div>

          {createProject.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {createProject.error instanceof Error
                ? createProject.error.message
                : 'Failed to create project'}
            </p>
          )}
        </div>

        {/* Footer — sits at the natural end of the form. The Modal's
            own scroll container handles overflow when needed. */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ⌘
            </kbd>{' '}
            +{' '}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{' '}
            to create
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Project
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
