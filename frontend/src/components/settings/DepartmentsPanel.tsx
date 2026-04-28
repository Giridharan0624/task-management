'use client'

import { useRef, useState } from 'react'
import { GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

/** Mirrors the seeded defaults on the backend's `OrgSettings` entity
 *  (backend/src/contexts/org/domain/entities.py:departments). Exported
 *  so the empty-state restore button has a one-click path. */
export const DEFAULT_DEPARTMENTS: string[] = [
  'Engineering',
  'Design',
  'Product',
  'Marketing',
  'Operations',
  'People',
]

interface DepartmentsPanelProps {
  value: string[]
  onChange: (next: string[]) => void
}

export function DepartmentsPanel({ value, onChange }: DepartmentsPanelProps) {
  const [draftName, setDraftName] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const trimmedDraft = draftName.trim()
  const draftCollides =
    !!trimmedDraft &&
    value.some((d) => d.toLowerCase() === trimmedDraft.toLowerCase())

  // Add stays clickable even when the input is empty — instead of being
  // greyed out, it bounces focus back to the field. Users were getting
  // confused by the disabled state and assumed the panel was broken.
  const addDepartment = () => {
    if (!trimmedDraft || draftCollides) {
      inputRef.current?.focus()
      return
    }
    onChange([...value, trimmedDraft])
    setDraftName('')
    inputRef.current?.focus()
  }

  const removeDepartment = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    if (editIndex === index) {
      setEditIndex(null)
      setEditValue('')
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  const startEdit = (index: number) => {
    setEditIndex(index)
    setEditValue(value[index])
  }

  const commitEdit = () => {
    if (editIndex === null) return
    const trimmed = editValue.trim()
    if (!trimmed) {
      removeDepartment(editIndex)
      setEditIndex(null)
      return
    }
    // Block rename to a name that already exists (case-insensitive),
    // unless the collision is with the row being edited itself.
    const collides = value.some(
      (d, i) => i !== editIndex && d.toLowerCase() === trimmed.toLowerCase(),
    )
    if (collides) {
      // Cancel — the input visibly reverts via blur.
      setEditIndex(null)
      setEditValue('')
      return
    }
    const next = value.map((d, i) => (i === editIndex ? trimmed : d))
    onChange(next)
    setEditIndex(null)
    setEditValue('')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Departments people can belong to. Used in the user create/edit form
        and as a filter on the admin Users page.{' '}
        <span className="text-muted-foreground/70">
          Renaming a department here does not rename historical user
          assignments — those keep their original label until a member is
          re-assigned.
        </span>
      </p>

      {/* Add new */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDepartment()
              }
            }}
            placeholder="Type a department name and press Enter"
            className="h-9"
          />
          {draftCollides && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              &ldquo;{trimmedDraft}&rdquo; already exists.
            </p>
          )}
        </div>
        <Button
          onClick={addDepartment}
          disabled={draftCollides}
          size="sm"
          className="h-9"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {value.length === 0 ? (
        <EmptyState
          title="No departments"
          description="Add at least one department or restore the standard set with one click."
          action={
            <Button onClick={() => onChange(DEFAULT_DEPARTMENTS)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restore defaults
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border/60">
            {value.map((name, i) => {
              const isEditing = editIndex === i
              return (
                <li
                  key={`${name}-${i}`}
                  className="group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/30"
                >
                  {/* Drag handle visual + chevron move buttons. No real
                      DnD — chevrons handle reorder so the pattern is
                      keyboard-friendly. */}
                  <div className="flex items-center text-muted-foreground/50">
                    <GripVertical className="h-3.5 w-3.5" />
                    <div className="flex flex-col text-[10px]">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="rounded px-0.5 hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === value.length - 1}
                        className="rounded px-0.5 hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  {/* Inline rename — click the name to edit. */}
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitEdit()
                        }
                        if (e.key === 'Escape') {
                          setEditIndex(null)
                          setEditValue('')
                        }
                      }}
                      autoFocus
                      className="h-8 flex-1"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(i)}
                      className={cn(
                        'flex-1 rounded px-2 py-1 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted',
                      )}
                      title="Click to rename"
                    >
                      {name}
                    </button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDepartment(i)}
                    aria-label={`Remove ${name}`}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
