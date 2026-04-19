'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'

export interface LeaveType {
  id: string
  name: string
  annualQuota: number
}

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
          description="Add at least one leave type so members can submit day-off requests."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_44px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Name</span>
            <span>ID</span>
            <span>Annual quota</span>
            <span></span>
          </div>
          <div className="divide-y divide-border/60">
            {value.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_44px] items-center gap-3 px-4 py-2"
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
                  className="h-9"
                />
                <Input
                  type="text"
                  value={row.id}
                  onChange={(e) => updateRow(i, { id: slugify(e.target.value) })}
                  placeholder="casual"
                  className="h-9 font-mono text-xs"
                />
                <Input
                  type="number"
                  min={0}
                  value={String(row.annualQuota)}
                  onChange={(e) =>
                    updateRow(i, { annualQuota: Number(e.target.value) || 0 })
                  }
                  className="h-9"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(i)}
                  aria-label="Remove leave type"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
