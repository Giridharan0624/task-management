'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useAttendanceReport } from '@/lib/hooks/useAttendance'
import { AttendanceButton } from '@/components/attendance/AttendanceButton'
import { TaskUpdateCard } from '@/components/taskupdate/TaskUpdateCard'
import { BirthdayBanner } from '@/components/ui/BirthdayBanner'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Sparkline } from '@/components/ui/Sparkline'
import { TASK_STATUS_COLORS, TASK_STATUS_LABEL } from '@/types/task'
import { isOverdue as checkOverdue, parseDeadline } from '@/lib/utils/deadline'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200',
  ADMIN: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  MEDIUM: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

function use7DayHours() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 6)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = now.toISOString().slice(0, 10)
  const { data } = useAttendanceReport(startStr, endStr)

  return useMemo(() => {
    const dayMap = new Map<string, number>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      dayMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of data ?? []) {
      const hrs = r.sessions.reduce(
        (s: number, se: { hours: number | null }) => s + (se.hours ?? 0),
        0
      )
      dayMap.set(r.date, (dayMap.get(r.date) ?? 0) + hrs)
    }
    return Array.from(dayMap.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
}

function StatCard({
  icon,
  label,
  value,
  color,
  gradient,
  href,
  sparkData,
  sparkColor,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
  gradient: string
  href?: string
  sparkData?: number[]
  sparkColor?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div
          className={`h-9 w-9 rounded-xl ${gradient} flex items-center justify-center shadow-sm`}
        >
          {icon}
        </div>
        {sparkData && sparkData.length >= 2 && (
          <Sparkline
            data={sparkData}
            color={sparkColor || '#6366f1'}
            height={28}
            width={56}
          />
        )}
      </div>
      <p className={`text-2xl font-bold ${color} tracking-tight tabular-nums`}>
        {value}
      </p>
      <p className="text-[10px] font-semibold text-muted-foreground/70 mt-1 uppercase tracking-widest">
        {label}
      </p>
    </>
  )
  const cls =
    'bg-card rounded-xl border border-border p-4 shadow-sm'
  if (href)
    return (
      <Link
        href={href}
        className={`${cls} hover:shadow-md hover:border-border/80 transition-all block`}
      >
        {content}
      </Link>
    )
  return <div className={cls}>{content}</div>
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
  return (
    <Link
      href={`/projects/${task.projectId}`}
      className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors group"
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
        <Badge className={TASK_STATUS_COLORS[task.status]}>
          {TASK_STATUS_LABEL[task.status as keyof typeof TASK_STATUS_LABEL] ??
            task.status}
        </Badge>
        <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
      </div>
    </Link>
  )
}

function OverdueAlert({
  tasks,
}: {
  tasks: {
    taskId: string
    projectId: string
    title: string
    deadline: string
  }[]
}) {
  if (tasks.length === 0) return null
  return (
    <div className="bg-red-50 rounded-2xl border border-red-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-4 h-4 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-[13px] font-bold text-red-700">
          {tasks.length} Overdue Task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-1.5">
        {tasks.slice(0, 3).map((t) => {
          const now = new Date()
          const dl = parseDeadline(t.deadline)
          const days = Math.round(
            (new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            ).getTime() -
              new Date(
                dl.getFullYear(),
                dl.getMonth(),
                dl.getDate()
              ).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          return (
            <Link
              key={t.taskId}
              href={`/projects/${t.projectId}`}
              className="flex items-center justify-between py-1 group"
            >
              <span className="text-[12px] font-medium text-red-800 truncate group-hover:underline">
                {t.title}
              </span>
              <span className="text-[10px] text-red-500 font-semibold flex-shrink-0 ml-2">
                {days}d overdue
              </span>
            </Link>
          )
        })}
        {tasks.length > 3 && (
          <Link
            href="/my-tasks"
            className="text-[11px] font-semibold text-red-600 hover:text-red-800"
          >
            +{tasks.length - 3} more
          </Link>
        )}
      </div>
    </div>
  )
}

function UpcomingDeadlines({
  tasks,
}: {
  tasks: {
    taskId: string
    projectId: string
    title: string
    deadline: string
    status: string
  }[]
}) {
  if (tasks.length === 0) return null
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-amber-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-[13px] font-bold text-foreground/95">Due Soon</h3>
        <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md">
          {tasks.length}
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {tasks.map((t) => {
          const _now = new Date()
          const _dl = parseDeadline(t.deadline)
          const diff = Math.round(
            (new Date(
              _dl.getFullYear(),
              _dl.getMonth(),
              _dl.getDate()
            ).getTime() -
              new Date(
                _now.getFullYear(),
                _now.getMonth(),
                _now.getDate()
              ).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          const label =
            diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`
          return (
            <Link
              key={t.taskId}
              href={`/projects/${t.projectId}`}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors group"
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  diff === 0
                    ? 'bg-red-400'
                    : diff === 1
                      ? 'bg-amber-400'
                      : 'bg-blue-400'
                }`}
              />
              <p className="text-[13px] font-medium text-foreground/95 flex-1 truncate group-hover:text-primary transition-colors">
                {t.title}
              </p>
              <span className="text-[10px] text-muted-foreground/70">
                {TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL] ??
                  t.status}
              </span>
              <span
                className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${
                  diff === 0
                    ? 'text-red-600'
                    : diff === 1
                      ? 'text-amber-600'
                      : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const Icons = {
  tasks: (
    <svg
      className="h-4 w-4 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
  todo: (
    <svg
      className="h-4 w-4 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  progress: (
    <svg
      className="h-4 w-4 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  done: (
    <svg
      className="h-4 w-4 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
}

export function MemberDashboard({ user }: { user: User }) {
  const { data: myTasks, isLoading } = useMyTasks()
  const sparkData = use7DayHours()

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length
  const activeCount = allTasks.length - todoCount - doneCount

  const now = new Date()
  const overdueTasks = allTasks.filter((t) =>
    checkOverdue(t.deadline, t.status)
  )
  const upcomingTasks = allTasks
    .filter((t) => {
      if (t.status === 'DONE' || !t.deadline) return false
      const diff =
        (parseDeadline(t.deadline).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 3
    })
    .sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Welcome back, {user.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground/70">{dateStr}</p>
        </div>
        <Badge className={ROLE_COLORS[user.systemRole ?? 'MEMBER']}>
          {user.systemRole}
        </Badge>
      </div>

      <BirthdayBanner />

      <AttendanceButton />

      <OverdueAlert tasks={overdueTasks} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger-up">
        <StatCard
          icon={Icons.tasks}
          label="Total"
          value={allTasks.length}
          color="text-indigo-700"
          gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
          href="/my-tasks"
          sparkData={sparkData}
          sparkColor="#6366f1"
        />
        <StatCard
          icon={Icons.todo}
          label="To Do"
          value={todoCount}
          color="text-amber-700"
          gradient="bg-gradient-to-br from-amber-400 to-orange-500"
          href="/my-tasks"
        />
        <StatCard
          icon={Icons.progress}
          label="Active"
          value={activeCount}
          color="text-blue-700"
          gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          href="/my-tasks"
        />
        <StatCard
          icon={Icons.done}
          label="Done"
          value={doneCount}
          color="text-emerald-700"
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          href="/my-tasks"
          sparkData={sparkData}
          sparkColor="#10b981"
        />
      </div>

      <UpcomingDeadlines tasks={upcomingTasks} />

      <div className="space-y-3">
        <SectionHeader title="Task Update" />
        <TaskUpdateCard />
      </div>

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
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-border/60">
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
    </div>
  )
}
