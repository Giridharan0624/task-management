'use client'

import { useState } from 'react'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import type { TaskUpdate } from '@/types/taskupdate'

function parseTime(t: string): number {
  const h = t.match(/(\d+)h/)
  const m = t.match(/(\d+)m/)
  const s = t.match(/(\d+)s/)
  return (
    (h ? parseInt(h[1]) : 0) +
    (m ? parseInt(m[1]) / 60 : 0) +
    (s ? parseInt(s[1]) / 3600 : 0)
  )
}

/**
 * Renders a time string with explicit hours, minutes, and seconds.
 * Input may be missing any part — legacy backend data only emits "Xh Ym"
 * so we default seconds to 0 rather than omitting them.
 */
function formatHMS(t: string): string {
  const h = t.match(/(\d+)h/)
  const m = t.match(/(\d+)m/)
  const s = t.match(/(\d+)s/)
  const hours = h ? parseInt(h[1]) : 0
  const mins = m ? parseInt(m[1]) : 0
  const secs = s ? parseInt(s[1]) : 0
  return `${hours}h ${mins}m ${secs}s`
}

interface SubmittedUpdateCardProps {
  update: TaskUpdate
  avatarUrl?: string
}

/**
 * Compact summary card on the Daily Updates grid. Click the card to open a
 * modal with the full sign-in/out times and per-task breakdown — keeps the
 * grid uniform at all times and gets around the ragged heights the earlier
 * collapse-in-place variant produced.
 */
export function SubmittedUpdateCard({
  update,
  avatarUrl,
}: SubmittedUpdateCardProps) {
  const [open, setOpen] = useState(false)
  const totalHrs = parseTime(update.totalTime)
  const taskCount = update.taskSummary.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${update.userName}'s daily update`}
        className="group w-full rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-border/80 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar url={avatarUrl} name={update.userName} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                {update.userName}
              </p>
              {update.employeeId && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {update.employeeId}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold tabular-nums text-primary">
              {formatHMS(update.totalTime)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              total
            </p>
          </div>
        </div>

        {/* Light summary line so the card conveys shape without being empty */}
        <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <LogIn className="h-3 w-3" />
            {update.signIn}
          </span>
          <span className="inline-flex items-center gap-1">
            <LogOut className="h-3 w-3" />
            {update.signOut}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold">
            <Clock className="h-3 w-3" />
            {taskCount} task{taskCount === 1 ? '' : 's'}
          </span>
        </div>
      </button>

      <UpdateDetailDialog
        open={open}
        onOpenChange={setOpen}
        update={update}
        avatarUrl={avatarUrl}
      />
    </>
  )
}

function UpdateDetailDialog({
  open,
  onOpenChange,
  update,
  avatarUrl,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  update: TaskUpdate
  avatarUrl?: string
}) {
  const totalHrs = parseTime(update.totalTime)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          {/* pr-8 keeps the name clear of the Dialog's built-in close (X)
              button at top-right. Total moves to its own tile below so it
              doesn't fight the close button for the same corner. */}
          <DialogTitle className="flex items-center gap-3 pr-8">
            <Avatar url={avatarUrl} name={update.userName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">
                {update.userName}
              </p>
              {update.employeeId && (
                <p className="font-mono text-[11px] font-normal text-muted-foreground">
                  {update.employeeId}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Total + sign-in + sign-out as a 3-tile strip. Total gets a
            primary accent so it stays the dominant number. */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-primary/10 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/80">
              Total
            </p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-primary">
              {formatHMS(update.totalTime)}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
            <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                In
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {update.signIn}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Out
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {update.signOut}
              </p>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="mt-1">
          <div className="mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Tasks ({update.taskSummary.length})
            </p>
          </div>
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {update.taskSummary.map((t, i) => {
              const taskHrs = parseTime(t.timeRecorded)
              const pct = totalHrs > 0 ? (taskHrs / totalHrs) * 100 : 0
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 text-xs font-medium text-foreground">
                      {t.taskName}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-primary">
                      {formatHMS(t.timeRecorded)}
                    </span>
                  </div>
                  <Progress value={pct} className="mt-1.5 h-1" />
                  {t.description && (
                    <p className="mt-1 text-[10px] italic text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
