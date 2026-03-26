'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BoardMember, BoardRole } from '@/types/user'
import { addMember, removeMember } from '@/lib/api/boardApi'
import { boardKeys } from '@/lib/hooks/useBoards'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface MemberListProps {
  boardId: string
  members: BoardMember[]
  canManageMembers: boolean
}

interface AddMemberFormValues {
  userId: string
  boardRole: BoardRole
}

export function MemberList({ boardId, members, canManageMembers }: MemberListProps) {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const addMemberMutation = useMutation({
    mutationFn: (data: AddMemberFormValues) => addMember(boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
      setShowAddModal(false)
      reset()
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberFormValues>({ defaultValues: { boardRole: 'MEMBER' } })

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the board?')) return
    setRemovingId(userId)
    try {
      await removeMember(boardId, userId)
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
    } finally {
      setRemovingId(null)
    }
  }

  const onSubmit = async (values: AddMemberFormValues) => {
    await addMemberMutation.mutateAsync(values)
  }

  const roleBadgeColor: Record<BoardRole, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    MEMBER: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="flex flex-col gap-4">
      {canManageMembers && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddModal(true)}>Add Member</Button>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No members yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Joined
                </th>
                {canManageMembers && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.userId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {member.user?.name ?? member.userId}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {member.user?.email ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeColor[member.boardRole]}`}
                    >
                      {member.boardRole}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {canManageMembers && (
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={removingId === member.userId}
                        onClick={() => handleRemove(member.userId)}
                      >
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); reset() }}
        title="Add Member"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="User ID"
            placeholder="Enter user ID"
            error={errors.userId?.message}
            {...register('userId', { required: 'User ID is required' })}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              {...register('boardRole', { required: true })}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {addMemberMutation.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {addMemberMutation.error instanceof Error
                ? addMemberMutation.error.message
                : 'Failed to add member'}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => { setShowAddModal(false); reset() }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Add Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
