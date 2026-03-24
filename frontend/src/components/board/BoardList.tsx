'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useBoards, useDeleteBoard } from '@/lib/hooks/useBoards'
import { BoardCard } from './BoardCard'
import { CreateBoardModal } from './CreateBoardModal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export function BoardList() {
  const { user } = useAuth()
  const { data: boards, isLoading, error } = useBoards()
  const deleteBoard = useDeleteBoard()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAdmin = user?.systemRole === 'ADMIN'

  const handleDelete = async (boardId: string) => {
    if (!confirm('Are you sure you want to delete this board? This action cannot be undone.')) return
    setDeletingId(boardId)
    try {
      await deleteBoard.mutateAsync(boardId)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        Failed to load boards. Please try again.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">My Boards</h2>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>Create Board</Button>
        )}
      </div>

      {!boards || boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 gap-4">
          <svg
            className="h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-500">No boards yet.</p>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>Create your first board</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <BoardCard
              key={board.boardId}
              board={board}
              canDeleteBoard={isAdmin}
              onDelete={handleDelete}
              isDeleting={deletingId === board.boardId}
            />
          ))}
        </div>
      )}

      <CreateBoardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
