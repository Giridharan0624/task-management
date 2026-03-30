'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useProjects } from '@/lib/hooks/useProjects'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { AttendanceButton } from '@/components/attendance/AttendanceButton'
import { AttendanceTable } from '@/components/attendance/AttendanceTable'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-200',
  CEO: 'bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200',
  MD: 'bg-fuchsia-100 text-fuchsia-800 ring-1 ring-inset ring-fuchsia-200',
  ADMIN: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200',
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  MEDIUM: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color, gradient, href }: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
  gradient: string
  href?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl ${gradient} flex items-center justify-center shadow-sm`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${color} tracking-tight`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-400 mt-1.5 uppercase tracking-widest">{label}</p>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card hover:shadow-card-hover hover:border-indigo-200/60 transition-all duration-200 cursor-pointer block hover-lift">
        {content}
      </Link>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
      {content}
    </div>
  )
}

/* ─── Quick Action Card ─── */
function ActionCard({ href, icon, title, subtitle }: {
  href: string; icon: React.ReactNode; title: string; subtitle: string
}) {
  return (
    <Link href={href} className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-card hover:shadow-card-hover hover:border-indigo-200/60 transition-all duration-200 group hover-lift">
      <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <svg className="h-4 w-4 text-gray-300 ml-auto group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

/* ─── Section Header ─── */
function SectionHeader({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h2>
      {href && <Link href={href} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors">{linkText ?? 'View all'}</Link>}
    </div>
  )
}

/* ─── Task Row ─── */
function TaskRow({ task }: { task: any }) {
  return (
    <Link href={`/projects/${task.projectId}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{task.title}</p>
          <p className="text-xs text-gray-400">{task.projectName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
        <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
      </div>
    </Link>
  )
}

/* ─── Icons ─── */
const Icons = {
  users: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  members: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  projects: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  tasks: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  todo: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  progress: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  done: <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  manage: <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  create: <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  viewTasks: <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
}

/* ─── Owner Dashboard ─── */
function OwnerDashboard() {
  const { data: users, isLoading: usersLoading } = useUsers()
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: myTasks } = useMyTasks()

  const adminCount = (users ?? []).filter((u) => u.systemRole === 'ADMIN' || u.systemRole === 'CEO' || u.systemRole === 'MD').length
  const memberCount = (users ?? []).filter((u) => u.systemRole === 'MEMBER').length

  const nameMap = new Map<string, string>()
  for (const u of users ?? []) nameMap.set(u.userId, u.name || u.email)
  const resolveName = (id: string) => nameMap.get(id) || 'Unknown'

  if (usersLoading || projectsLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 stagger-fade">
        <StatCard icon={Icons.users} label="Admins" value={adminCount} color="text-violet-700" gradient="bg-gradient-to-br from-violet-500 to-purple-600" href="/admin/users" />
        <StatCard icon={Icons.members} label="Members" value={memberCount} color="text-blue-700" gradient="bg-gradient-to-br from-blue-500 to-cyan-600" href="/admin/users" />
        <StatCard icon={Icons.projects} label="Projects" value={projects?.length ?? 0} color="text-indigo-700" gradient="bg-gradient-to-br from-indigo-500 to-blue-600" href="/projects" />
        <StatCard icon={Icons.tasks} label="All Tasks" value={(myTasks ?? []).length} color="text-emerald-700" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" href="/my-tasks" />
      </div>

      <div className="space-y-4">
        <SectionHeader title="Team Attendance" />
        <AttendanceTable />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionCard href="/admin/users" icon={Icons.manage} title="Manage Users" subtitle="Add or manage team members" />
        <ActionCard href="/projects" icon={Icons.create} title="Create Project" subtitle="Start a new project" />
      </div>

      <div className="space-y-3">
        <SectionHeader title="Recent Projects" href="/projects" />
        {(projects ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
            <p className="text-gray-400 text-sm">No projects yet</p>
            <Link href="/projects" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">Create your first project</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden divide-y divide-gray-50">
            {(projects ?? []).slice(0, 5).map((p) => (
              <Link key={p.projectId} href={`/projects/${p.projectId}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/80 transition-colors group">
                <div>
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {p.createdBy && <span>by {resolveName(p.createdBy)}</span>}
                    {p.createdBy && p.description && <span> · </span>}
                    {p.description && <span>{p.description}</span>}
                  </p>
                </div>
                <svg className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ─── Admin Dashboard ─── */
function AdminDashboard() {
  const { data: myTasks, isLoading: myTasksLoading } = useMyTasks()
  const { data: users, isLoading: usersLoading } = useUsers()

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const progressCount = allTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length
  const memberCount = (users ?? []).filter((u) => u.systemRole === 'MEMBER').length

  if (myTasksLoading || usersLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 stagger-fade">
        <StatCard icon={Icons.todo} label="To Do" value={todoCount} color="text-amber-700" gradient="bg-gradient-to-br from-amber-400 to-orange-500" href="/my-tasks" />
        <StatCard icon={Icons.progress} label="In Progress" value={progressCount} color="text-blue-700" gradient="bg-gradient-to-br from-blue-500 to-cyan-600" href="/my-tasks" />
        <StatCard icon={Icons.done} label="Done" value={doneCount} color="text-emerald-700" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" href="/my-tasks" />
        <StatCard icon={Icons.members} label="My Members" value={memberCount} color="text-indigo-700" gradient="bg-gradient-to-br from-indigo-500 to-purple-600" href="/admin/users" />
      </div>

      <AttendanceButton />

      <div className="space-y-4">
        <SectionHeader title="Team Attendance" />
        <AttendanceTable />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionCard href="/my-tasks" icon={Icons.viewTasks} title="View Tasks" subtitle="See all assigned tasks" />
        <ActionCard href="/admin/users" icon={Icons.manage} title="Manage Members" subtitle="Add or manage members" />
      </div>

      <div className="space-y-3">
        <SectionHeader title="My Tasks" href="/my-tasks" />
        {allTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
            <p className="text-gray-400 text-sm">No tasks assigned to you yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden divide-y divide-gray-50">
            {allTasks.slice(0, 5).map((task) => <TaskRow key={task.taskId} task={task} />)}
            {allTasks.length > 5 && (
              <div className="text-center py-3 bg-gray-50/60">
                <Link href="/my-tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors">View all {allTasks.length} tasks</Link>
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

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const progressCount = allTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 stagger-fade">
        <StatCard icon={Icons.tasks} label="Total Tasks" value={allTasks.length} color="text-indigo-700" gradient="bg-gradient-to-br from-indigo-500 to-purple-600" href="/my-tasks" />
        <StatCard icon={Icons.todo} label="To Do" value={todoCount} color="text-amber-700" gradient="bg-gradient-to-br from-amber-400 to-orange-500" href="/my-tasks" />
        <StatCard icon={Icons.progress} label="In Progress" value={progressCount} color="text-blue-700" gradient="bg-gradient-to-br from-blue-500 to-cyan-600" href="/my-tasks" />
        <StatCard icon={Icons.done} label="Done" value={doneCount} color="text-emerald-700" gradient="bg-gradient-to-br from-emerald-500 to-teal-600" href="/my-tasks" />
      </div>

      <AttendanceButton />

      <div className="grid grid-cols-1 gap-3">
        <ActionCard href="/my-tasks" icon={Icons.viewTasks} title="View All Tasks" subtitle="See all your assigned tasks" />
      </div>

      <div className="space-y-3">
        <SectionHeader title="My Tasks" href="/my-tasks" />
        {allTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
            <p className="text-gray-400 text-sm">No tasks assigned to you yet</p>
            <Link href="/projects" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">Go to Projects</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden divide-y divide-gray-50">
            {allTasks.slice(0, 5).map((task) => <TaskRow key={task.taskId} task={task} />)}
            {allTasks.length > 5 && (
              <div className="text-center py-3 bg-gray-50/60">
                <Link href="/my-tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors">View all {allTasks.length} tasks</Link>
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

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">Here&apos;s what&apos;s happening today.</p>
        </div>
        <Badge className={ROLE_COLORS[user?.systemRole ?? 'MEMBER']}>
          {user?.systemRole}
        </Badge>
      </div>

      {(user?.systemRole === 'OWNER' || user?.systemRole === 'CEO' || user?.systemRole === 'MD') && <OwnerDashboard />}
      {user?.systemRole === 'ADMIN' && <AdminDashboard />}
      {user?.systemRole === 'MEMBER' && <MemberDashboard />}
    </div>
  )
}
