'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRole, useUserProgress } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
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
  const createUserMutation = useCreateUser()
  const deleteUserMutation = useDeleteUser()
  const updateRole = useUpdateUserRole()

  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [progressUser, setProgressUser] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('MEMBER')

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

  // Filter users based on caller's role
  const isOwner = currentUser?.systemRole === 'OWNER'
  const filteredUsers = isOwner
    ? users ?? []
    : (users ?? []).filter((u) => u.systemRole !== 'OWNER' && u.systemRole !== 'ADMIN')

  // Available roles for creation based on caller
  const creatableRoles = isOwner ? ['ADMIN', 'MEMBER', 'VIEWER'] : ['MEMBER', 'VIEWER']

  const handleCreateUser = async () => {
    setError('')
    if (!newEmail || !newName || !newPassword) {
      setError('All fields are required')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    try {
      await createUserMutation.mutateAsync({
        email: newEmail,
        name: newName,
        password: newPassword,
        system_role: newRole,
      })
      setShowAddUser(false)
      setNewEmail('')
      setNewName('')
      setNewPassword('')
      setNewRole('MEMBER')
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    try {
      await deleteUserMutation.mutateAsync(deleteTarget.userId)
      setDeleteTarget(null)
    } catch (err: any) {
      alert(err.message || 'Failed to delete user')
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateRole.mutateAsync({ userId, systemRole: role })
      setSelectedUser(null)
    } catch (err: any) {
      alert(err.message || 'Failed to update role')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">
            {isOwner ? 'Manage admins and users' : 'Manage users'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={ROLE_COLORS[currentUser?.systemRole ?? 'MEMBER']}>
            {currentUser?.systemRole}
          </Badge>
          <Button variant="primary" onClick={() => setShowAddUser(true)}>
            + Add {isOwner ? 'Admin / User' : 'User'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {isOwner && (
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <div className="text-2xl font-bold text-red-700">
              {(users ?? []).filter((u) => u.systemRole === 'ADMIN').length}
            </div>
            <div className="text-sm text-red-600">Admins</div>
          </div>
        )}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">
            {(users ?? []).filter((u) => u.systemRole === 'MEMBER').length}
          </div>
          <div className="text-sm text-blue-600">Members</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-700">
            {(users ?? []).filter((u) => u.systemRole === 'VIEWER').length}
          </div>
          <div className="text-sm text-gray-600">Viewers</div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{(users ?? []).length}</div>
          <div className="text-sm text-indigo-600">Total Users</div>
        </div>
      </div>

      {/* User Table */}
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
            {filteredUsers.map((u) => (
              <tr key={u.userId} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setProgressUser(u.userId)}>
                      Progress
                    </Button>
                    {isOwner && u.systemRole !== 'OWNER' && (
                      <Button variant="secondary" size="sm" onClick={() => setSelectedUser(u)}>
                        Role
                      </Button>
                    )}
                    {u.systemRole !== 'OWNER' && u.userId !== currentUser?.userId && (
                      (() => {
                        const canDelete = isOwner || (currentUser?.systemRole === 'ADMIN' && u.systemRole !== 'ADMIN')
                        return canDelete ? (
                          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(u)}>
                            Delete
                          </Button>
                        ) : null
                      })()
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No users found. Click &quot;Add&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Modal isOpen={showAddUser} onClose={() => { setShowAddUser(false); setError('') }} title="Create New User">
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input
              type="password"
              placeholder="Min 8 characters, 1 uppercase, 1 number"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowAddUser(false); setError('') }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name || deleteTarget?.email}</span>?
            This will remove them from Cognito and all board memberships. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Role Change Modal */}
      <Modal
        isOpen={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        title={`Change role: ${selectedUser?.name || selectedUser?.email || ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Current role: <Badge className={ROLE_COLORS[selectedUser?.systemRole ?? 'MEMBER']}>{selectedUser?.systemRole}</Badge>
          </p>
          <div className="flex gap-2">
            {['ADMIN', 'MEMBER', 'VIEWER'].map((role) => (
              <Button
                key={role}
                variant={selectedUser?.systemRole === role ? 'primary' : 'secondary'}
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
      {progressUser && (
        <UserProgressModal userId={progressUser} onClose={() => setProgressUser(null)} />
      )}
    </div>
  )
}

function UserProgressModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: progress, isLoading } = useUserProgress(userId)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Progress: ${progress?.user?.name || progress?.user?.email || 'Loading...'}`}
    >
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : progress ? (
        <div className="space-y-4">
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
