'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useBoards } from '@/lib/hooks/useBoards'
import { useMyTasks, useUsers } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-orange-100 text-orange-800',
  LOW: 'bg-gray-100 text-gray-600',
}

function SummaryCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string
  value: number | string
  color: string
  bgColor?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-200 p-5 shadow-sm ${bgColor || 'bg-white'}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function OwnerDashboard() {
  const { data: users, isLoading: usersLoading } = useUsers()
  const { data: boards, isLoading: boardsLoading } = useBoards()
  const { data: myTasks } = useMyTasks()

  const adminCount = (users ?? []).filter((u) => u.systemRole === 'ADMIN').length
  const memberCount = (users ?? []).filter((u) => u.systemRole === 'MEMBER').length
  const totalTasks = (myTasks ?? []).length

  const isLoading = usersLoading || boardsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Admins" value={adminCount} color="text-red-700" bgColor="bg-red-50" />
        <SummaryCard label="Total Members" value={memberCount} color="text-blue-700" bgColor="bg-blue-50" />
        <SummaryCard label="Total Boards" value={boards?.length ?? 0} color="text-indigo-700" bgColor="bg-indigo-50" />
        <SummaryCard label="Total Tasks" value={totalTasks} color="text-green-700" bgColor="bg-green-50" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          href="/admin/users"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
        >
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">Manage Users</p>
            <p className="text-xs text-gray-500">Add or manage admins and members</p>
          </div>
        </Link>
        <Link
          href="/boards"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
        >
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">Create Board</p>
            <p className="text-xs text-gray-500">Start a new project board</p>
          </div>
        </Link>
      </div>

      {/* Recent Boards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Boards</h2>
          <Link href="/boards" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {(boards ?? []).length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-gray-500 text-sm">No boards yet.</p>
            <Link href="/boards" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
              Create your first board
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(boards ?? []).slice(0, 5).map((board) => (
              <Link
                key={board.boardId}
                href={`/boards/${board.boardId}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
              >
                <div>
                  <p className="font-medium text-gray-900">{board.name}</p>
                  {board.description && (
                    <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{board.description}</p>
                  )}
                </div>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function AdminDashboard() {
  const { data: myTasks, isLoading: myTasksLoading } = useMyTasks()
  const { data: users, isLoading: usersLoading } = useUsers()

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const progressCount = allTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length
  const memberCount = (users ?? []).filter((u) => u.systemRole === 'MEMBER').length

  const previewTasks = allTasks.slice(0, 5)

  const isLoading = myTasksLoading || usersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="To Do" value={todoCount} color="text-yellow-700" bgColor="bg-yellow-50" />
        <SummaryCard label="In Progress" value={progressCount} color="text-blue-700" bgColor="bg-blue-50" />
        <SummaryCard label="Done" value={doneCount} color="text-green-700" bgColor="bg-green-50" />
        <SummaryCard label="My Members" value={memberCount} color="text-indigo-700" bgColor="bg-indigo-50" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          href="/my-tasks"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
        >
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">View Tasks</p>
            <p className="text-xs text-gray-500">See all your assigned tasks</p>
          </div>
        </Link>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
        >
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">Manage Members</p>
            <p className="text-xs text-gray-500">Add or manage members</p>
          </div>
        </Link>
      </div>

      {/* My Tasks Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
          <Link href="/my-tasks" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {previewTasks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-gray-500 text-sm">No tasks assigned to you yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Board</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewTasks.map((task) => (
                  <tr key={task.taskId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link
                        href={`/boards/${task.boardId}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{task.boardName}</span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <Badge className={STATUS_COLORS[task.status]}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <Badge className={PRIORITY_COLORS[task.priority]}>
                        {task.priority}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allTasks.length > 5 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                <Link href="/my-tasks" className="text-sm font-medium text-blue-600 hover:underline">
                  View all {allTasks.length} tasks
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function MemberDashboard() {
  const { data: myTasks, isLoading: myTasksLoading } = useMyTasks()

  const allTasks = myTasks ?? []
  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const progressCount = allTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length

  const previewTasks = allTasks.slice(0, 5)

  if (myTasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Tasks" value={allTasks.length} color="text-indigo-700" bgColor="bg-indigo-50" />
        <SummaryCard label="To Do" value={todoCount} color="text-yellow-700" bgColor="bg-yellow-50" />
        <SummaryCard label="In Progress" value={progressCount} color="text-blue-700" bgColor="bg-blue-50" />
        <SummaryCard label="Done" value={doneCount} color="text-green-700" bgColor="bg-green-50" />
      </div>

      {/* Quick Action */}
      <div className="flex gap-3">
        <Link
          href="/my-tasks"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
        >
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">View All Tasks</p>
            <p className="text-xs text-gray-500">See all your assigned tasks</p>
          </div>
        </Link>
      </div>

      {/* My Tasks Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
          <Link href="/my-tasks" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {previewTasks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-gray-500 text-sm">No tasks assigned to you yet.</p>
            <Link href="/boards" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
              Go to Boards
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Board</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewTasks.map((task) => (
                  <tr key={task.taskId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link
                        href={`/boards/${task.boardId}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{task.boardName}</span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <Badge className={STATUS_COLORS[task.status]}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <Badge className={PRIORITY_COLORS[task.priority]}>
                        {task.priority}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allTasks.length > 5 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                <Link href="/my-tasks" className="text-sm font-medium text-blue-600 hover:underline">
                  View all {allTasks.length} tasks
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-1 text-gray-500">Here&apos;s what&apos;s happening today.</p>
        </div>
        <Badge className={ROLE_COLORS[user?.systemRole ?? 'MEMBER']}>
          {user?.systemRole}
        </Badge>
      </div>

      {user?.systemRole === 'OWNER' && <OwnerDashboard />}
      {user?.systemRole === 'ADMIN' && <AdminDashboard />}
      {user?.systemRole === 'MEMBER' && <MemberDashboard />}
    </div>
  )
}
