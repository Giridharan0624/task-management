'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBoard, useDeleteBoard } from '@/lib/hooks/useBoards'
import { useTasks } from '@/lib/hooks/useTasks'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePermission } from '@/lib/hooks/usePermission'
import { TaskKanban } from '@/components/task/TaskKanban'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { BoardRole } from '@/types/user'

export default function BoardDetailPage() {
  const params = useParams()
  const boardId = params.boardId as string
  const router = useRouter()
  const { user } = useAuth()

  const { data: board, isLoading: boardLoading, error: boardError } = useBoard(boardId)
  const { data: tasks, isLoading: tasksLoading } = useTasks(boardId)
  const deleteBoard = useDeleteBoard()

  // Determine current user's role in this board
  const currentMember = board?.members?.find((m) => m.userId === user?.userId)
  const boardRole = currentMember?.boardRole as BoardRole | undefined
  const permissions = usePermission(boardRole)

  const handleDeleteBoard = async () => {
    if (!confirm('Delete this board and all its tasks? This cannot be undone.')) return
    await deleteBoard.mutateAsync(boardId)
    router.push('/boards')
  }

  if (boardLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (boardError || !board) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        Failed to load board. It may not exist or you may not have access.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/boards"
            className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Back to boards"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{board.name}</h1>
            {board.description && (
              <p className="mt-0.5 text-sm text-gray-500">{board.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {permissions.canManageMembers && (
            <Link href={`/boards/${boardId}/members`}>
              <Button variant="secondary" size="sm">
                Manage Members
              </Button>
            </Link>
          )}
          {permissions.canDeleteBoard && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteBoard}
              loading={deleteBoard.isPending}
            >
              Delete Board
            </Button>
          )}
        </div>
      </div>

      {/* Kanban */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <TaskKanban
          boardId={boardId}
          tasks={tasks ?? []}
          permissions={permissions}
        />
      )}
    </div>
  )
}
