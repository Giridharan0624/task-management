'use client'

import { useState } from 'react'
import { Bookmark, BookmarkPlus, X, Pencil, Check } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './Popover'
import { paramsMatch, type SavedView } from '@/lib/hooks/useSavedViews'
import { cn } from '@/lib/utils'

interface SavedViewsBarProps {
  views: SavedView[]
  /** Current URL filters — used both to flag the active view and as the
   *  body of the next "save current" action. */
  currentParams: Record<string, string>
  onApply: (view: SavedView) => void
  onSave: (name: string, params: Record<string, string>) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  /** When true, no filters are active and "Save current" is hidden to
   *  avoid saving an empty view. */
  saveDisabled?: boolean
}

export function SavedViewsBar({
  views,
  currentParams,
  onApply,
  onSave,
  onRemove,
  onRename,
  saveDisabled,
}: SavedViewsBarProps) {
  const activeId = views.find((v) => paramsMatch(v.params, currentParams))?.id

  if (views.length === 0 && saveDisabled) return null

  return (
    <div
      role="toolbar"
      aria-label="Saved views"
      className="flex flex-wrap items-center gap-1.5"
    >
      {views.length > 0 && (
        <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Bookmark className="h-3 w-3" />
          Views
        </span>
      )}

      {views.map((view) => (
        <SavedViewChip
          key={view.id}
          view={view}
          isActive={view.id === activeId}
          onApply={() => onApply(view)}
          onRemove={() => onRemove(view.id)}
          onRename={(name) => onRename(view.id, name)}
        />
      ))}

      {!saveDisabled && (
        <SaveCurrentButton
          currentParams={currentParams}
          onSave={onSave}
          existingNames={views.map((v) => v.name.toLowerCase())}
        />
      )}
    </div>
  )
}

function SavedViewChip({
  view,
  isActive,
  onApply,
  onRemove,
  onRename,
}: {
  view: SavedView
  isActive: boolean
  onApply: () => void
  onRemove: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(view.name)

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = draftName.trim()
          if (trimmed && trimmed !== view.name) onRename(trimmed)
          setEditing(false)
        }}
        className="inline-flex items-center gap-1 rounded-full border border-primary bg-card px-1 py-0.5"
      >
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            const trimmed = draftName.trim()
            if (trimmed && trimmed !== view.name) onRename(trimmed)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraftName(view.name)
              setEditing(false)
            }
          }}
          className="h-6 w-28 bg-transparent px-2 text-xs font-semibold text-foreground focus:outline-none"
          aria-label="Rename view"
        />
        <button
          type="submit"
          aria-label="Save name"
          className="flex h-5 w-5 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <Check className="h-3 w-3" />
        </button>
      </form>
    )
  }

  return (
    <div
      className={cn(
        'group inline-flex items-center rounded-full border text-xs font-semibold transition-colors',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground'
      )}
    >
      <button
        type="button"
        onClick={onApply}
        className="py-1 pl-3 pr-1.5 focus:outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ring"
      >
        {view.name}
      </button>
      <div className="flex items-center pr-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDraftName(view.name)
            setEditing(true)
          }}
          aria-label={`Rename ${view.name}`}
          className="invisible flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 hover:bg-muted hover:text-foreground group-hover:visible"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Delete ${view.name}`}
          className="invisible flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive group-hover:visible"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function SaveCurrentButton({
  currentParams,
  onSave,
  existingNames,
}: {
  currentParams: Record<string, string>
  onSave: (name: string, params: Record<string, string>) => void
  existingNames: string[]
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setOpen(false)
    setName('')
    setError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError('A view with this name already exists')
      return
    }
    onSave(trimmed, currentParams)
    close()
  }

  return (
    <Popover open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save view
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Input
            label="View name"
            autoFocus
            placeholder="My overdue, This sprint..."
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            error={error ?? undefined}
            className="h-9"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" type="button" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
