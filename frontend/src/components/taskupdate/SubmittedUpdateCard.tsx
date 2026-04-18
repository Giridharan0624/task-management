'use client'

import { Clock, LogIn, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
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

interface SubmittedUpdateCardProps {
  update: TaskUpdate
  avatarUrl?: string
}

export function SubmittedUpdateCard({
  update,
  avatarUrl,
}: SubmittedUpdateCardProps) {
  const totalHrs = parseTime(update.totalTime)

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar url={avatarUrl} name={update.userName} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
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
          <p className="text-lg font-bold tabular-nums text-primary">
            {update.totalTime}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            total
          </p>
        </div>
      </div>

      {/* Sign in/out */}
      <div className="mb-4 grid grid-cols-2 gap-2">
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
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Tasks ({update.taskSummary.length})
          </p>
        </div>
        <div className="space-y-1.5">
          {update.taskSummary.map((t, i) => {
            const taskHrs = parseTime(t.timeRecorded)
            const pct = totalHrs > 0 ? (taskHrs / totalHrs) * 100 : 0
            return (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1 truncate text-xs font-medium text-foreground">
                    {t.taskName}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-primary">
                    {t.timeRecorded}
                  </span>
                </div>
                <Progress value={pct} className="mt-1.5 h-1" />
                {t.description && (
                  <p className="mt-1 truncate text-[10px] italic text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
