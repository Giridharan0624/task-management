'use client'

import { useRouter } from 'next/navigation'
import type { Board } from '@/types/board'
import { Button } from '@/components/ui/Button'

interface BoardCardProps {
  board: Board
  canDeleteBoard: boolean
  onDelete: (boardId: string) => void
  isDeleting?: boolean
}

export function BoardCard({ board, canDeleteBoard, onDelete, isDeleting }: BoardCardProps) {
  const router = useRouter()

  const memberCount = board.members?.length ?? 0
  const createdDate = new Date(board.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking delete button
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    router.push(`/boards/${board.boardId}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
          {board.name}
        </h3>
        {canDeleteBoard && (
          <Button
            variant="danger"
            size="sm"
            loading={isDeleting}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(board.boardId)
            }}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Delete board ${board.name}`}
          >
            Delete
          </Button>
        )}
      </div>

      {board.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{board.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span>
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </span>
        <span>Created {createdDate}</span>
      </div>
    </div>
  )
}
