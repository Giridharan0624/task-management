'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, Clock, Flame, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A stylized "in-app" preview that floats next to the hero copy on large
 * screens. Two animated ideas in one frame:
 *
 *   1. A task cycles TODO → IN_PROGRESS → DONE on a 6s loop so the page
 *      always has subtle motion without being loud.
 *   2. A second card shows a progress bar filling up on the same rhythm.
 *
 * All driven by a single `step` state so the two visuals stay in sync.
 * Uses GPU-accelerated transforms, respects `prefers-reduced-motion`.
 */
const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const
type Status = (typeof STATUSES)[number]

const STATUS_META: Record<Status, { label: string; color: string; dot: string }> = {
  TODO: { label: 'To do', color: 'text-amber-600', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'In progress', color: 'text-blue-600', dot: 'bg-blue-500' },
  DONE: { label: 'Done', color: 'text-emerald-600', dot: 'bg-emerald-500' },
}

export function HeroTaskMockup() {
  const [step, setStep] = useState(0)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedRef.current) return

    const id = setInterval(() => setStep((s) => (s + 1) % STATUSES.length), 2200)
    return () => clearInterval(id)
  }, [])

  const currentStatus = STATUSES[step]
  const progressPct = [22, 64, 100][step]

  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-[420px] select-none"
    >
      {/* Ambient halo behind the mockup */}
      <div className="absolute -inset-8 -z-10 rounded-[36px] bg-gradient-to-br from-primary/25 via-accent/15 to-transparent blur-3xl animate-drift-slow" />

      {/* The "window chrome" */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-elevated backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 font-mono text-[10px] text-muted-foreground">
            app.taskflow.com / my-tasks
          </span>
        </div>

        <div className="space-y-2.5 p-4">
          {/* Stat strip row */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Today" value="6h 24m" accent="text-primary" />
            <MiniStat label="Done" value="14" accent="text-emerald-600" />
            <MiniStat label="Due" value="3" accent="text-amber-600" />
          </div>

          {/* Cycling status card */}
          <TaskCard
            title="Wire Stripe Connect onboarding"
            project="Payments"
            priority="HIGH"
            status={currentStatus}
          />

          {/* Progress card that fills in sync */}
          <TaskCard
            title="Refresh hero imagery for homepage"
            project="Marketing"
            priority="MED"
            status="IN_PROGRESS"
            progressOverride={progressPct}
          />

          {/* Static filler */}
          <TaskCard
            title="Publish updated data-retention policy"
            project="Ops"
            priority="LOW"
            status="DONE"
            progressOverride={100}
          />
        </div>
      </div>

      {/* Floating "live" chip that bounces gently — tells the eye the mockup is alive */}
      <div className="absolute -right-4 top-6 flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-700 shadow-md backdrop-blur animate-float dark:text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live
      </div>

      {/* Floating priority chip */}
      <div className="absolute -left-6 bottom-20 hidden items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-700 shadow-md backdrop-blur animate-float-lg sm:flex dark:text-amber-200">
        <Flame className="h-3.5 w-3.5" />
        3 overdue
      </div>

      {/* Floating activity chip */}
      <div
        className="absolute -right-8 bottom-8 hidden items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/15 px-3 py-1.5 text-[11px] font-bold text-primary shadow-md backdrop-blur animate-float-lg sm:flex"
        style={{ animationDelay: '-3s' }}
      >
        <Zap className="h-3.5 w-3.5" />
        Activity 89%
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="rounded-xl bg-muted/50 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 text-sm font-bold tabular-nums', accent)}>{value}</p>
    </div>
  )
}

function TaskCard({
  title,
  project,
  priority,
  status,
  progressOverride,
}: {
  title: string
  project: string
  priority: 'HIGH' | 'MED' | 'LOW'
  status: Status
  progressOverride?: number
}) {
  const meta = STATUS_META[status]
  const priColor =
    priority === 'HIGH'
      ? 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-500/30'
      : priority === 'MED'
        ? 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30'
        : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30'

  const pct =
    progressOverride ??
    (status === 'DONE' ? 100 : status === 'IN_PROGRESS' ? 55 : 8)

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {status === 'DONE' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            )}
            <p className="truncate text-[12px] font-semibold text-foreground">
              {title}
            </p>
          </div>
          <p className="mt-0.5 pl-5 text-[10px] text-muted-foreground">
            {project}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset',
            priColor
          )}
        >
          {priority}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 pl-5">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-semibold',
            meta.color
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
          {meta.label}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{
                width: `${pct}%`,
                transition: 'width 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            />
          </div>
          <span className="w-7 text-right text-[9px] font-bold tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </span>
          <Clock className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
