'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBoard } from '@/lib/hooks/useBoards'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePermission } from '@/lib/hooks/usePermission'
import { MemberList } from '@/components/board/MemberList'
import { Spinner } from '@/components/ui/Spinner'
import type { BoardRole } from '@/types/user'
import { useEffect } from 'react'

export default function MembersPage() {
  const params = useParams()
  const boardId = params.boardId as string
  const router = useRouter()
  const { user } = useAuth()

  const { data: board, isLoading, error } = useBoard(boardId)

  const currentMember = board?.members?.find((m) => m.userId === user?.userId)
  const boardRole = currentMember?.boardRole as BoardRole | undefined
  const permissions = usePermission(boardRole)

  // Redirect non-admins away from this page
  useEffect(() => {
    if (!isLoading && board && !permissions.canManageMembers) {
      router.replace(`/boards/${boardId}`)
    }
  }, [isLoading, board, permissions.canManageMembers, boardId, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !board) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        Failed to load board.
      </div>
    )
  }

  if (!permissions.canManageMembers) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/boards/${boardId}`}
          className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Back to board"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-0.5 text-sm text-gray-500">{board.name}</p>
        </div>
      </div>

      <MemberList
        boardId={boardId}
        members={board.members ?? []}
        canManageMembers={permissions.canManageMembers}
      />
    </div>
  )
}
