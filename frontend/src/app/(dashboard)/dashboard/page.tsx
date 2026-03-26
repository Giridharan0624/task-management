'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useBoards } from '@/lib/hooks/useBoards'
import { useTasks } from '@/lib/hooks/useTasks'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800',
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function DashboardContent() {
  const { user } = useAuth()
  const systemPerms = useSystemPermission(user?.systemRole)
  const { data: boards, isLoading: boardsLoading } = useBoards()

  const allBoardIds = boards?.map((b) => b.boardId) ?? []
  const boardsForStats = allBoardIds.slice(0, 3)

  const { data: tasks0 } = useTasks(boardsForStats[0] ?? '')
  const { data: tasks1 } = useTasks(boardsForStats[1] ?? '')
  const { data: tasks2 } = useTasks(boardsForStats[2] ?? '')

  const allTasks = [
    ...(tasks0 ?? []),
    ...(tasks1 ?? []),
    ...(tasks2 ?? []),
  ]

  const todoCount = allTasks.filter((t) => t.status === 'TODO').length
  const inProgressCount = allTasks.filter((t) => t.status === 'IN_PROGRESS').length
  const doneCount = allTasks.filter((t) => t.status === 'DONE').length

  const recentBoards = boards?.slice(0, 5) ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-1 text-gray-500">Here&apos;s what&apos;s happening across your boards.</p>
        </div>
        <Badge className={ROLE_COLORS[user?.systemRole ?? 'MEMBER']}>
          {user?.systemRole}
        </Badge>
      </div>

      {/* Quick Actions for Owner/Admin */}
      {systemPerms.canManageUsers && (
        <div className="flex gap-3">
          <Link
            href="/admin/users"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
          >
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">User Management</p>
              <p className="text-xs text-gray-500">Manage users and roles</p>
            </div>
          </Link>
        </div>
      )}

      {/* Summary cards */}
      {boardsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total Boards" value={boards?.length ?? 0} color="text-gray-900" />
            <SummaryCard label="To Do" value={todoCount} color="text-gray-700" />
            <SummaryCard label="In Progress" value={inProgressCount} color="text-blue-700" />
            <SummaryCard label="Done" value={doneCount} color="text-green-700" />
          </div>

          {/* Recent boards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Boards</h2>
              <Link
                href="/boards"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
            {recentBoards.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
                <p className="text-gray-500 text-sm">No boards yet.</p>
                <Link
                  href="/boards"
                  className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
                >
                  Go to Boards
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recentBoards.map((board) => (
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
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return <DashboardContent />
}
