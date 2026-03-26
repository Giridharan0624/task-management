'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useUsers, useUpdateUserRole, useUserProgress } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800',
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const systemPerms = useSystemPermission(currentUser?.systemRole)
  const { data: users, isLoading } = useUsers()
  const updateRole = useUpdateUserRole()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [progressUser, setProgressUser] = useState<string | null>(null)

  if (!systemPerms.canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">You don&apos;t have permission to view this page.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRole.mutateAsync({ userId, systemRole: newRole })
      setSelectedUser(null)
    } catch (err: any) {
      alert(err.message || 'Failed to update role')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage users and their roles</p>
        </div>
        <Badge className={ROLE_COLORS[currentUser?.systemRole ?? 'MEMBER']}>
          {currentUser?.systemRole}
        </Badge>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users?.map((u) => (
              <tr key={u.userId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-600 font-medium text-sm">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{u.name || 'Unnamed'}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={ROLE_COLORS[u.systemRole] || ROLE_COLORS.MEMBER}>
                    {u.systemRole}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                  {systemPerms.canViewProgress && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setProgressUser(u.userId)}
                    >
                      View Progress
                    </Button>
                  )}
                  {systemPerms.canManageAdmins && u.systemRole !== 'OWNER' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedUser(u)}
                    >
                      Change Role
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Change Modal */}
      <Modal
        isOpen={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        title={`Change role: ${selectedUser?.name || selectedUser?.email || ''}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Current role: <span className="font-medium">{selectedUser?.systemRole}</span>
          </p>
          <div className="flex gap-2">
            {['ADMIN', 'MEMBER', 'VIEWER'].map((role) => (
              <Button
                key={role}
                variant={selectedUser?.systemRole === role ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => selectedUser && handleRoleChange(selectedUser.userId, role)}
                disabled={updateRole.isPending}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Progress Modal */}
      <UserProgressModal
        userId={progressUser}
        onClose={() => setProgressUser(null)}
      />
    </div>
  )
}

function UserProgressModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data: progress, isLoading } = useUserProgress(userId ?? '')

  return (
    <Modal
      isOpen={userId !== null}
      onClose={onClose}
      title={`Progress: ${progress?.user?.name || progress?.user?.email || 'Loading...'}`}
    >
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : progress ? (
        <div className="space-y-4">
          {/* Overall Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{progress.total_stats.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{progress.total_stats.TODO}</div>
              <div className="text-xs text-gray-500">To Do</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{progress.total_stats.IN_PROGRESS}</div>
              <div className="text-xs text-gray-500">In Progress</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{progress.total_stats.DONE}</div>
              <div className="text-xs text-gray-500">Done</div>
            </div>
          </div>

          {/* Per-board breakdown */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {progress.boards.map((board) => (
              <div key={board.board_id} className="border rounded-lg p-3">
                <h4 className="font-medium text-gray-900">{board.board_name}</h4>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">{board.stats.TODO} To Do</span>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{board.stats.IN_PROGRESS} In Progress</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">{board.stats.DONE} Done</span>
                </div>
                {board.tasks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {board.tasks.map((task) => (
                      <li key={task.taskId} className="text-sm text-gray-600 flex justify-between">
                        <span>{task.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{task.status.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {progress.boards.length === 0 && (
              <p className="text-gray-500 text-center py-4">No tasks assigned to this user.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
