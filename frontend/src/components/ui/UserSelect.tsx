'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { Avatar } from './AvatarUpload'
import { cn } from '@/lib/utils'

interface UserOption {
  userId: string
  name: string
  email: string
  avatarUrl?: string
  extra?: string // e.g. role, department
}

interface UserSelectProps {
  users: UserOption[]
  value: string
  onChange: (userId: string) => void
  placeholder?: string
  className?: string
}

/**
 * User picker built on Radix Popover so it nests correctly inside Radix
 * Dialog — clicks inside the popover don't dismiss the parent dialog.
 * Previously used a hand-rolled createPortal which Dialog treated as an
 * outside interaction and closed the modal before onClick could run.
 */
export function UserSelect({
  users,
  value,
  onChange,
  placeholder = 'Search and select user...',
  className,
}: UserSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [triggerWidth, setTriggerWidth] = useState<number>(0)

  const selected = users.find((u) => u.userId === value)

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase()
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.extra || '').toLowerCase().includes(q)
        )
      })
    : users

  // Size the popover to match the trigger.
  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth)
    }
  }, [open])

  // Reset search each time the popover opens.
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-left transition-all',
            'hover:border-border/80',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
            className
          )}
        >
          {selected ? (
            <>
              <Avatar
                name={selected.name}
                url={selected.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {selected.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {selected.email}
                </p>
              </div>
            </>
          ) : (
            <span className="flex-1 text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 overflow-hidden"
        style={{ width: triggerWidth || undefined }}
      >
        {/* Search */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              autoFocus
              className="w-full rounded-lg border border-input bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No users found
            </p>
          ) : (
            filtered.map((u) => {
              const isActive = u.userId === value
              return (
                <button
                  key={u.userId}
                  type="button"
                  onClick={() => {
                    onChange(u.userId)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-primary/10'
                      : 'hover:bg-muted/60'
                  )}
                >
                  <Avatar name={u.name} url={u.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        isActive
                          ? 'font-semibold text-primary'
                          : 'font-medium text-foreground'
                      )}
                    >
                      {u.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {u.email}
                      {u.extra ? ` · ${u.extra}` : ''}
                    </p>
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Multi-select variant with checkboxes and search — unchanged, already inline (no portal). */
interface UserMultiSelectProps {
  users: UserOption[]
  selected: string[]
  onChange: (userIds: string[]) => void
  placeholder?: string
  className?: string
}

export function UserMultiSelect({
  users,
  selected,
  onChange,
  placeholder = 'Search and select users...',
  className,
}: UserMultiSelectProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase()
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.extra || '').toLowerCase().includes(q)
        )
      })
    : users

  const toggle = (userId: string) => {
    onChange(
      selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : [...selected, userId]
    )
  }

  return (
    <div className={className}>
      {/* Search */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none transition-all focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* User list */}
      <div className="max-h-40 divide-y divide-border/60 overflow-y-auto rounded-xl border border-input">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No users found
          </p>
        ) : (
          filtered.map((u) => {
            const isSelected = selected.includes(u.userId)
            return (
              <label
                key={u.userId}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-all',
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                )}
              >
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-input'
                  )}
                >
                  {isSelected && (
                    <Check
                      className="h-3 w-3 text-primary-foreground"
                      strokeWidth={3}
                    />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(u.userId)}
                  className="sr-only"
                />
                <Avatar name={u.name} url={u.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-sm',
                      isSelected
                        ? 'font-semibold text-foreground'
                        : 'text-foreground/85'
                    )}
                  >
                    {u.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {u.email}
                    {u.extra ? ` · ${u.extra}` : ''}
                  </span>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
