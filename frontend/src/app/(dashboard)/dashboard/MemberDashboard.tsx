'use client'

import Link from 'next/link'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { AttendanceButton } from '@/components/attendance/AttendanceButton'
import { TaskUpdateCard } from '@/components/taskupdate/TaskUpdateCard'
import { BirthdayBanner } from '@/components/ui/BirthdayBanner'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { TeamPulseStrip } from '@/components/dashboard/TeamPulseStrip'
// WhoIsWorking + OnLeaveToday are admin-only — the /attendance/today and
// /day-offs/all endpoints require ATTENDANCE_REPORT_VIEW / DAYOFF_LIST_ALL,
// both of which members lack. Excluded from this view.
import { TopProjects } from '@/components/dashboard/TopProjects'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { TASK_STATUS_COLORS } from '@/types/task'
import { useStatusLabel } from '@/lib/tenant/usePipelines'
import { useValueFlash } from '@/lib/hooks/useValueFlash'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user'

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  MEDIUM: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

function SectionHeader({
  title,
  href,
  linkText,
}: {
  title: string
  href?: string
  linkText?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[13px] font-bold text-foreground/95">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          {linkText ?? 'View all →'}
        </Link>
      )}
    </div>
  )
}

function TaskRow({
  task,
}: {
  task: {
    taskId: string
    projectId: string
    title: string
    projectName?: string
    status: string
    priority: string
  }
}) {
  const labelOf = useStatusLabel()
  const statusFlash = useValueFlash(task.status)
  return (
    <Link
      href={`/projects/${task.projectId}`}
      className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors group pressable"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg
            className="h-3.5 w-3.5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground/95 truncate group-hover:text-primary transition-colors">
            {task.title}
          </p>
          {task.projectName && (
            <p className="text-[11px] text-muted-foreground/70">
              {task.projectName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
        <Badge className={cn(TASK_STATUS_COLORS[task.status], statusFlash)}>
          {labelOf(task.status)}
        </Badge>
        <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
      </div>
    </Link>
  )
}

export function MemberDashboard({ user }: { user: User }) {
  const { data: myTasks, isLoading } = useMyTasks()

  const allTasks = myTasks ?? []

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5 animate-fade-in stagger-up">
      {/* 1. Today hero — greeting + member-specific action prompts */}
      <TodayHero userName={user.name} role="MEMBER" />

      {/* 2. Personal timer / sessions */}
      <AttendanceButton />

      {/* 3. Pulse strip — my hours, my active, my completed, my overdue */}
      <TeamPulseStrip role="MEMBER" />

      {/* 4. Most active projects the member participates in */}
      <TopProjects />

      {/* 5. Role-scoped quick actions */}
      <QuickActions role="MEMBER" />

      {/* 6. Daily update submission — member-specific below the shell */}
      <div className="space-y-3">
        <SectionHeader title="Daily Update" />
        <TaskUpdateCard />
      </div>

      {/* 7. My Tasks — top 5 */}
      <div className="space-y-3">
        <SectionHeader title="My Tasks" href="/my-tasks" />
        {allTasks.length === 0 ? (
          <div className="bg-card rounded-2xl border-2 border-dashed border-border/80 py-10 text-center">
            <p className="text-[13px] text-muted-foreground/70">
              No tasks assigned to you yet
            </p>
            <Link
              href="/projects"
              className="mt-2 inline-block text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Go to Projects →
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-border/60 stagger-up">
            {allTasks.slice(0, 5).map((task) => (
              <TaskRow key={task.taskId} task={task} />
            ))}
            {allTasks.length > 5 && (
              <div className="text-center py-3 bg-muted/30">
                <Link
                  href="/my-tasks"
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  View all {allTasks.length} tasks →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8. Birthday banner — lowest priority */}
      <BirthdayBanner />
    </div>
  )
}
