'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { cn } from '@/lib/utils'

interface DayOffCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (data: { startDate: string; endDate: string; reason: string }) => void
  isPending: boolean
}

/**
 * Min-date helper: members can request day-off for today only if it's
 * before 5 PM IST; after that the earliest allowed is tomorrow. Kept in
 * sync with the admin policy that was in the original page.
 */
function earliestAllowedDate(): string {
  const now = new Date()
  const istHour = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  ).getHours()
  if (istHour < 17) return now.toISOString().slice(0, 10)
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function DayOffCreateDialog({
  open,
  onClose,
  onCreate,
  isPending,
}: DayOffCreateDialogProps) {
  const [mode, setMode] = useState<'single' | 'multiple'>('single')
  const [singleDate, setSingleDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const minDate = earliestAllowedDate()

  const canSubmit =
    reason.trim().length > 0 &&
    ((mode === 'single' && !!singleDate) ||
      (mode === 'multiple' && !!startDate && !!endDate))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    if (mode === 'single') {
      const start = startTime ? `${singleDate}T${startTime}` : singleDate
      const end = endTime ? `${singleDate}T${endTime}` : singleDate
      onCreate({ startDate: start, endDate: end, reason: reason.trim() })
    } else {
      onCreate({ startDate, endDate, reason: reason.trim() })
    }
  }

  const reset = () => {
    setMode('single')
    setSingleDate('')
    setStartTime('')
    setEndTime('')
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request day off</DialogTitle>
          <DialogDescription>
            Your request will be sent to an admin for approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Duration type */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={mode === 'single'}
                onClick={() => setMode('single')}
              >
                Single day
              </ToggleButton>
              <ToggleButton
                active={mode === 'multiple'}
                onClick={() => setMode('multiple')}
              >
                Multiple days
              </ToggleButton>
            </div>
          </div>

          {mode === 'single' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Date
                </label>
                <DatePicker
                  value={singleDate}
                  onChange={setSingleDate}
                  min={minDate}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Time range{' '}
                  <span className="text-muted-foreground/70">
                    (optional — leave blank for full day)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker
                    value={startTime}
                    onChange={setStartTime}
                    placeholder="From"
                  />
                  <TimePicker
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'multiple' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Start date
                </label>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  min={minDate}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  End date
                </label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate || minDate}
                />
              </div>
            </div>
          )}

          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why do you need time off?"
          />

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-border/70 hover:bg-muted/40'
      )}
    >
      {children}
    </button>
  )
}
