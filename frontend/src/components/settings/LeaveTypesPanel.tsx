'use client'

import { Plus, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'

export interface LeaveType {
  id: string
  name: string
  annualQuota: number
}

/** Mirrors the seeded defaults on the backend's `OrgSettings` entity
 *  (backend/src/contexts/org/domain/entities.py). Kept here so the
 *  empty-state "Restore defaults" button can re-seed without an API
 *  round-trip, and so DayOffCreateDialog can fall back to them when
 *  the org's saved list is empty. */
export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: 'casual', name: 'Casual', annualQuota: 12 },
  { id: 'sick', name: 'Sick', annualQuota: 10 },
  { id: 'earned', name: 'Earned', annualQuota: 15 },
]

interface LeaveTypesPanelProps {
  value: LeaveType[]
  onChange: (next: LeaveType[]) => void
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function LeaveTypesPanel({ value, onChange }: LeaveTypesPanelProps) {
  const updateRow = (index: number, patch: Partial<LeaveType>) => {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onChange(next)
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const addRow = () => {
    let id = `leave_${value.length + 1}`
    while (value.some((r) => r.id === id)) {
      id = `leave_${id}_${Math.floor(Math.random() * 1000)}`
    }
    onChange([...value, { id, name: '', annualQuota: 0 }])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Categories your members can request day-offs against. Annual quota is
          the number of days allowed per year.
        </p>
        <Button variant="secondary" size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add type
        </Button>
      </div>

      {value.length === 0 ? (
        <EmptyState
          title="No leave types"
          description="Add at least one leave type so members can submit day-off requests. You can restore the standard set with one click."
          action={
            <div className="flex items-center justify-center gap-2">
              <Button onClick={() => onChange(DEFAULT_LEAVE_TYPES)}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore defaults
              </Button>
              <Button variant="secondary" onClick={addRow}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add custom
              </Button>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
          {/* Column headers — uppercase tracked-caps eyebrow row, hairline below */}
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_36px] gap-4 border-b border-border/60 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span>Name</span>
            <span>ID</span>
            <span>Annual quota</span>
            <span className="sr-only">Remove</span>
          </div>
          {/* Body rows — hairline-divided, no per-row card chrome. Each
              cell uses the bare Input (label rendered in the header row
              above, not per-cell). */}
          <div className="divide-y divide-border/50">
            {value.map((row, i) => (
              <div
                key={i}
                className="group grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_36px] items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/20"
              >
                <Input
                  type="text"
                  value={row.name}
                  onChange={(e) => {
                    const name = e.target.value
                    const newId = !row.id || row.id.startsWith('leave_')
                      ? slugify(name) || row.id
                      : row.id
                    updateRow(i, { name, id: newId })
                  }}
                  placeholder="Casual"
                  aria-label="Leave type name"
                />
                <Input
                  type="text"
                  value={row.id}
                  onChange={(e) => updateRow(i, { id: slugify(e.target.value) })}
                  placeholder="casual"
                  aria-label="Leave type identifier"
                  className="font-mono text-xs"
                />
                <Input
                  type="number"
                  min={0}
                  value={String(row.annualQuota)}
                  onChange={(e) =>
                    updateRow(i, { annualQuota: Number(e.target.value) || 0 })
                  }
                  aria-label="Annual quota in days"
                  rightIcon={
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                      d
                    </span>
                  }
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label={`Remove ${row.name || 'leave type'}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
