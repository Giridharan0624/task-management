'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useProjects } from '@/lib/hooks/useProjects'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { AttendanceButton } from '@/components/attendance/AttendanceButton'
import { BirthdayBanner } from '@/components/ui/BirthdayBanner'
import { AttendanceTable } from '@/components/attendance/AttendanceTable'
import { TaskUpdateCard } from '@/components/taskupdate/TaskUpdateCard'
import { TASK_STATUS_COLORS, TASK_STATUS_LABEL } from '@/types/task'
import { useAttendanceReport, useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useTaskUpdates } from '@/lib/hooks/useTaskUpdates'
import { Sparkline } from '@/components/ui/Sparkline'
import { isOverdue as checkOverdue, parseDeadline } from '@/lib/utils/deadline'
import { useMemo } from 'react'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200',
  ADMIN: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
}

const STATUS_COLORS: Record<string, string> = TASK_STATUS_COLORS
const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  MEDIUM: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

/* ─── Small Components ─── */

function StatCard({ icon, label, value, color, gradient, href, sparkData, sparkColor }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; gradient: string; href?: string; sparkData?: number[]; sparkColor?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className={`h-9 w-9 rounded-xl ${gradient} flex items-center justify-center shadow-sm`}>{icon}</div>
        {sparkData && sparkData.length >= 2 && <Sparkline data={sparkData} color={sparkColor || '#6366f1'} height={28} width={56} />}
      </div>
      <p className={`text-2xl font-bold ${color} tracking-tight tabular-nums`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-widest">{label}</p>
    </>
  )
  const cls = "bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
  if (href) return <Link href={href} className={`${cls} hover:shadow-md hover:border-gray-200 transition-all block`}>{content}</Link>
  return <div className={cls}>{content}</div>
}


function ActionCard({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group">
      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors flex-shrink-0">{icon}</div>
      <div>
        <p className="text-[13px] font-semibold text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-400">{subtitle}</p>
      </div>
      <svg className="h-4 w-4 text-gray-300 ml-auto group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

function SectionHeader({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[13px] font-bold text-gray-800">{title}</h2>
      {href && <Link href={href} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">{linkText ?? 'View all →'}</Link>}
    </div>
  )
}

function TaskRow({ task }: { task: { taskId: string; projectId: string; title: string; projectName?: string; status: string; priority: string } }) {
  return (
    <Link href={`/projects/${task.projectId}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/80 transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-gray-800 truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
          {task.projectName && <p className="text-[11px] text-gray-400">{task.projectName}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
        <Badge className={STATUS_COLORS[task.status]}>{TASK_STATUS_LABEL[task.status as keyof typeof TASK_STATUS_LABEL] ?? task.status}</Badge>
        <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
      </div>
    </Link>
  )
}

/* ─── Overdue Alert ─── */
function OverdueAlert({ tasks }: { tasks: { taskId: string; projectId: string; title: string; deadline: string }[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="bg-red-50 rounded-2xl border border-red-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="text-[13px] font-bold text-red-700">{tasks.length} Overdue Task{tasks.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1.5">
        {tasks.slice(0, 3).map(t => {
          const now = new Date()
          const dl = parseDeadline(t.deadline)
          const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime()) / (1000 * 60 * 60 * 24))
          return (
            <Link key={t.taskId} href={`/projects/${t.projectId}`} className="flex items-center justify-between py-1 group">
              <span className="text-[12px] font-medium text-red-800 truncate group-hover:underline">{t.title}</span>
              <span className="text-[10px] text-red-500 font-semibold flex-shrink-0 ml-2">{days}d overdue</span>
            </Link>
          )
        })}
        {tasks.length > 3 && (
          <Link href="/my-tasks" className="text-[11px] font-semibold text-red-600 hover:text-red-800">+{tasks.length - 3} more</Link>
        )}
      </div>
    </div>
  )
}

/* ─── Pending Task Updates Alert ─── */
function PendingUpdatesAlert() {
  const { data: todayAttendance } = useTodayAttendance()
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayUpdates } = useTaskUpdates(today)

  const pendingUsers = useMemo(() => {
    if (!todayAttendance) return []
    const submittedUserIds = new Set((todayUpdates ?? []).map(u => u.userId))
    return todayAttendance.filter(a =>
      a.sessions && a.sessions.length > 0 && !submittedUserIds.has(a.userId)
    )
  }, [todayAttendance, todayUpdates])

  if (pendingUsers.length === 0) return null

  return (
    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        <span className="text-[13px] font-bold text-amber-700">{pendingUsers.length} Pending Task Update{pendingUsers.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1.5">
        {pendingUsers.slice(0, 5).map(u => (
          <Link key={u.userId} href="/task-updates" className="flex items-center justify-between py-1 group">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="text-[12px] font-medium text-amber-800 truncate group-hover:underline">{u.userName}</span>
              <Badge className={ROLE_COLORS[u.systemRole] || ROLE_COLORS.MEMBER}>{u.systemRole}</Badge>
            </div>
            <span className="text-[10px] text-amber-500 font-semibold flex-shrink-0 ml-2">Not submitted</span>
          </Link>
        ))}
        {pendingUsers.length > 5 && (
          <Link href="/task-updates" className="text-[11px] font-semibold text-amber-600 hover:text-amber-800">+{pendingUsers.length - 5} more</Link>
        )}
      </div>
    </div>
  )
}

/* ─── Upcoming Deadlines ─── */
function UpcomingDeadlines({ tasks }: { tasks: { taskId: string; projectId: string; title: string; deadline: string; status: string }[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <h3 className="text-[13px] font-bold text-gray-800">Due Soon</h3>
        <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md">{tasks.length}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.map(t => {
          const _now = new Date()
          const _dl = parseDeadline(t.deadline)
          const diff = Math.round((new Date(_dl.getFullYear(), _dl.getMonth(), _dl.getDate()).getTime() - new Date(_now.getFullYear(), _now.getMonth(), _now.getDate()).getTime()) / (1000 * 60 * 60 * 24))
          const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`
          return (
            <Link key={t.taskId} href={`/projects/${t.projectId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors group">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${diff === 0 ? 'bg-red-400' : diff === 1 ? 'bg-amber-400' : 'bg-blue-400'}`} />
              <p className="text-[13px] font-medium text-gray-800 flex-1 truncate group-hover:text-indigo-600 transition-colors">{t.title}</p>
              <span className="text-[10px] text-gray-400">{TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL] ?? t.status}</span>
              <span className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${diff === 0 ? 'text-red-600' : diff === 1 ? 'text-amber-600' : 'text-gray-500'}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}


/* ─── Project Progress Cards (for owner/admin) ─── */
import { getProjectColor } from '@/lib/utils/projectColor'

function ProjectProgressCards({ projects }: { projects: { projectId: string; name: string; taskCount?: number; doneCount?: number; completionPercent?: number }[] }) {
  if (!projects.length) return null
  return (
    <div className="space-y-3">
      <SectionHeader title="Project Progress" href="/projects" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.slice(0, 6).map(p => {
          const pct = p.completionPercent ?? 0
          const total = p.taskCount ?? 0
          const done = p.doneCount ?? 0
          return (
            <Link key={p.projectId} href={`/projects/${p.projectId}`} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getProjectColor(p.name)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-[11px] font-bold">{p.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-indigo-600 transition-colors">{p.name}</p>
                  <p className="text-[10px] text-gray-400">{done}/{total} tasks done</p>
                </div>
                <span className={`text-[12px] font-bold tabular-nums ${pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-indigo-600' : 'text-gray-500'}`}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Icons ─── */
const Icons = {
  users: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  members: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  projects: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  tasks: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  todo: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  progress: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  done: <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  manage: <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  create: <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  viewTasks: <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
}

/* ─── 7-day sparkline helper ─── */
function use7DayHours() {
  const now = new Date()
  const start = new Date(now); start.setDate(start.getDate() - 6)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = now.toISOString().slice(0, 10)
  const { data } = useAttendanceReport(startStr, endStr)

  return useMemo(() => {
    const dayMap = new Map<string, number>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      dayMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of data ?? []) {
      const hrs = r.sessions.reduce((s: number, se: { hours: number | null }) => s + (se.hours ?? 0), 0)
      dayMap.set(r.date, (dayMap.get(r.date) ?? 0) + hrs)
    }
    return Array.from(dayMap.values())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
}

/* ─── Admin Dashboard (OWNER + ADMIN) ─── */
function OwnerDashboard() {
  const { data: users, isLoading: usersLoading } = useUsers()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: myTasks } = useMyTasks()
  const sparkData = use7DayHours()

  const adminCount = (users ?? []).filter(u => u.systemRole === 'ADMIN').length
  const memberCount = (users ?? []).filter(u => u.systemRole === 'MEMBER').length

  const now = new Date()
  const overdueTasks = (myTasks ?? []).filter(t => checkOverdue(t.deadline, t.status))
  const upcomingTasks = (myTasks ?? []).filter(t => {
    if (t.status === 'DONE' || !t.deadline) return false
    const diff = (parseDeadline(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())

  if (usersLoading || projectsLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <>
      <OverdueAlert tasks={overdueTasks} />
      <PendingUpdatesAlert />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Icons.users} label="Admins" value={adminCount} color="text-violet-700" gradient="bg-gradient-to-br from-violet-500 to-purple-600" href="/admin/users" />
        <StatCard icon={Icons.members} label="Members" value={memberCount} color="text-blue-700" gradient="bg-gradient-to-br from-blue-500 to-cyan-600" href="/admin/users" />
        <StatCard icon={Icons.projects} label="Projects" value={projects?.length ?? 0} color="text-indigo-700" gradient="bg-gradient-to-br from-indigo-500 to-blue-600" href="/projects" sparkData={sparkData} sparkColor="#6366f1" />
        <StatCard icon={Icons.tasks} label="All Tasks" value={(myTasks ?? []).length} color="text-emerald-700" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" href="/my-tasks" sparkData={sparkData} sparkColor="#10b981" />
      </div>

      <UpcomingDeadlines tasks={upcomingTasks} />
      <ProjectProgressCards projects={projects ?? []} />

      <div className="space-y-4">
        <SectionHeader title="Team Attendance" />
        <AttendanceTable />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionCard href="/admin/users" icon={Icons.manage} title="Manage Users" subtitle="Add or manage team members" />
        <ActionCard href="/projects" icon={Icons.create} title="Create Project" subtitle="Start a new project" />
      </div>

    </>
  )
}

/* ─── Admin Dashboard ─── */
function AdminDashboard() {
  const { data: myTasks, isLoading: myTasksLoading } = useMyTasks()
  const { data: users, isLoading: usersLoading } = useUsers()
  const { data: projects } = useProjects()
  const sparkData = use7DayHours()

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter(t => t.status === 'TODO').length
  const doneCount = allTasks.filter(t => t.status === 'DONE').length
  const activeCount = allTasks.length - todoCount - doneCount
  const memberCount = (users ?? []).filter(u => u.systemRole === 'MEMBER').length

  const now = new Date()
  const overdueTasks = allTasks.filter(t => checkOverdue(t.deadline, t.status))
  const upcomingTasks = allTasks.filter(t => {
    if (t.status === 'DONE' || !t.deadline) return false
    const diff = (parseDeadline(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())

  if (myTasksLoading || usersLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <>
      {/* HERO: Timer */}
      <AttendanceButton />

      <OverdueAlert tasks={overdueTasks} />
      <PendingUpdatesAlert />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Icons.todo} label="To Do" value={todoCount} color="text-amber-700" gradient="bg-gradient-to-br from-amber-400 to-orange-500" href="/my-tasks" />
        <StatCard icon={Icons.progress} label="Active" value={activeCount} color="text-blue-700" gradient="bg-gradient-to-br from-blue-500 to-cyan-600" href="/my-tasks" />
        <StatCard icon={Icons.done} label="Done" value={doneCount} color="text-emerald-700" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" href="/my-tasks" sparkData={sparkData} sparkColor="#10b981" />
        <StatCard icon={Icons.members} label="Members" value={memberCount} color="text-indigo-700" gradient="bg-gradient-to-br from-indigo-500 to-purple-600" href="/admin/users" />
      </div>

      <UpcomingDeadlines tasks={upcomingTasks} />

      <div className="space-y-3">
        <SectionHeader title="Task Update" />
        <TaskUpdateCard />
      </div>

      <ProjectProgressCards projects={projects ?? []} />

      <div className="space-y-4">
        <SectionHeader title="Team Attendance" />
        <AttendanceTable />
      </div>

      <div className="space-y-3">
        <SectionHeader title="My Tasks" href="/my-tasks" />
        {allTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-[13px] text-gray-400">No tasks assigned to you yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {allTasks.slice(0, 5).map(task => <TaskRow key={task.taskId} task={task} />)}
            {allTasks.length > 5 && (
              <div className="text-center py-3 bg-gray-50/60">
                <Link href="/my-tasks" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">View all {allTasks.length} tasks →</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ─── Member Dashboard ─── */
function MemberDashboard() {
  const { data: myTasks, isLoading } = useMyTasks()
  const sparkData = use7DayHours()

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter(t => t.status === 'TODO').length
  const doneCount = allTasks.filter(t => t.status === 'DONE').length
  const activeCount = allTasks.length - todoCount - doneCount

  const now = new Date()
  const overdueTasks = allTasks.filter(t => checkOverdue(t.deadline, t.status))
  const upcomingTasks = allTasks.filter(t => {
    if (t.status === 'DONE' || !t.deadline) return false
    const diff = (parseDeadline(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <>
      {/* HERO: Timer */}
      <AttendanceButton />

      <OverdueAlert tasks={overdueTasks} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Icons.tasks} label="Total" value={allTasks.length} color="text-indigo-700" gradient="bg-gradient-to-br from-indigo-500 to-purple-600" href="/my-tasks" sparkData={sparkData} sparkColor="#6366f1" />
        <StatCard icon={Icons.todo} label="To Do" value={todoCount} color="text-amber-700" gradient="bg-gradient-to-br from-amber-400 to-orange-500" href="/my-tasks" />
        <StatCard icon={Icons.progress} label="Active" value={activeCount} color="text-blue-700" gradient="bg-gradient-to-br from-blue-500 to-cyan-600" href="/my-tasks" />
        <StatCard icon={Icons.done} label="Done" value={doneCount} color="text-emerald-700" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" href="/my-tasks" sparkData={sparkData} sparkColor="#10b981" />
      </div>

      <UpcomingDeadlines tasks={upcomingTasks} />

      <div className="space-y-3">
        <SectionHeader title="Task Update" />
        <TaskUpdateCard />
      </div>

      <div className="space-y-3">
        <SectionHeader title="My Tasks" href="/my-tasks" />
        {allTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-[13px] text-gray-400">No tasks assigned to you yet</p>
            <Link href="/projects" className="mt-2 inline-block text-[13px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">Go to Projects →</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {allTasks.slice(0, 5).map(task => <TaskRow key={task.taskId} task={task} />)}
            {allTasks.length > 5 && (
              <div className="text-center py-3 bg-gray-50/60">
                <Link href="/my-tasks" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">View all {allTasks.length} tasks →</Link>
              </div>
            )}
          </div>
        )}
      </div>

    </>
  )
}

/* ─── Main ─── */
export default function DashboardPage() {
  const { user } = useAuth()

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            {user?.systemRole === 'OWNER'
              ? `Welcome, ${user?.name ?? 'there'}`
              : `Welcome back, ${user?.name?.split(' ')[0] ?? 'there'}`}
          </h1>
          <p className="mt-0.5 text-[13px] text-gray-400">{dateStr}</p>
        </div>
        <Badge className={ROLE_COLORS[user?.systemRole ?? 'MEMBER']}>{user?.systemRole}</Badge>
      </div>

      {/* Birthday Banner */}
      <BirthdayBanner />

      {(user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN') && <OwnerDashboard />}
      {user?.systemRole === 'MEMBER' && <MemberDashboard />}
    </div>
  )
}
