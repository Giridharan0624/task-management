'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRole, useUpdateUserDepartment, useUserProgress } from '@/lib/hooks/useUsers'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/AvatarUpload'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  CEO: 'bg-violet-100 text-violet-800',
  MD: 'bg-fuchsia-100 text-fuchsia-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
}

type TabType = 'ADMIN' | 'MEMBER'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const systemPerms = useSystemPermission(currentUser?.systemRole)
  const { data: users, isLoading } = useUsers()
  const createUserMutation = useCreateUser()
  const deleteUserMutation = useDeleteUser()
  const updateRole = useUpdateUserRole()
  const updateDept = useUpdateUserDepartment()

  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [progressUser, setProgressUser] = useState<string | null>(null)
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('ALL')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('ADMIN')

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('MEMBER')
  const [newDepartment, setNewDepartment] = useState('')

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

  const isTopTier = currentUser?.systemRole === 'OWNER' || currentUser?.systemRole === 'CEO' || currentUser?.systemRole === 'MD'
  const isOwner = currentUser?.systemRole === 'OWNER'

  // Build a userId -> name map for resolving "created by"
  const userMap = new Map((users ?? []).map((u) => [u.userId, u.name || u.email]))
  if (currentUser) userMap.set(currentUser.userId, currentUser.name || currentUser.email)

  // Filter users by role groups
  const ceoMd = (users ?? []).filter((u) => u.systemRole === 'CEO' || u.systemRole === 'MD')
  const adminsOnly = (users ?? []).filter((u) => u.systemRole === 'ADMIN')
  const members = (users ?? []).filter((u) => u.systemRole === 'MEMBER')

  const rawDisplayedUsers = isTopTier
    ? (activeTab === 'ADMIN' ? [...ceoMd, ...adminsOnly] : members)
    : members

  const deptFiltered = deptFilter === 'ALL'
    ? rawDisplayedUsers
    : rawDisplayedUsers.filter((u) => (u.department || '').toLowerCase() === deptFilter.toLowerCase())

  const displayedUsers = searchQuery.trim()
    ? deptFiltered.filter((u) => {
        const q = searchQuery.toLowerCase()
        return (u.name || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q)
          || (u.designation || '').toLowerCase().includes(q)
          || (u.department || '').toLowerCase().includes(q)
      })
    : deptFiltered

  // Available roles for creation based on caller
  const creatableRoles = isOwner
    ? ['CEO', 'MD', 'ADMIN', 'MEMBER']
    : isTopTier
      ? ['ADMIN', 'MEMBER']
      : ['MEMBER']

  const handleCreateUser = async () => {
    setError('')
    if (!newEmail || !newName || !newPassword || !newDepartment) {
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
        systemRole: newRole,
        department: newDepartment,
      })
      setShowAddUser(false)
      setNewEmail('')
      setNewName('')
      setNewPassword('')
      setNewRole('MEMBER')
      setNewDepartment('')
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
          <h1 className="text-2xl font-bold text-gray-900">
            {isOwner ? 'User Management' : 'Member Management'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isOwner ? 'Manage admins and members' : 'Manage members'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={ROLE_COLORS[currentUser?.systemRole ?? 'MEMBER']}>
            {currentUser?.systemRole}
          </Badge>
          <Button variant="primary" onClick={() => setShowAddUser(true)}>
            + Add {isOwner ? 'User' : 'Member'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, designation, or department..."
          className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Department Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Department:</span>
        {['ALL', 'Development', 'Designing', 'Management', 'Research'].map((dept) => {
          const isActive = deptFilter === (dept === 'ALL' ? 'ALL' : dept)
          const count = dept === 'ALL'
            ? rawDisplayedUsers.length
            : rawDisplayedUsers.filter((u) => (u.department || '').toLowerCase() === dept.toLowerCase()).length
          return (
            <button
              key={dept}
              onClick={() => setDeptFilter(dept === 'ALL' ? 'ALL' : dept)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {dept}
              <span className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {isOwner && (
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <div className="text-2xl font-bold text-red-700">{ceoMd.length + adminsOnly.length}</div>
            <div className="text-sm text-red-600">Admins</div>
          </div>
        )}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-2xl font-bold text-blue-700">{members.length}</div>
          <div className="text-sm text-blue-600">Members</div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="text-2xl font-bold text-indigo-700">{(users ?? []).length}</div>
          <div className="text-sm text-indigo-600">Total Users</div>
        </div>
      </div>

      {/* Tabs (Owner only) */}
      {isOwner && (
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'ADMIN'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Management ({ceoMd.length + adminsOnly.length})
          </button>
          <button
            onClick={() => setActiveTab('MEMBER')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'MEMBER'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
        </div>
      )}

      {/* User Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedUsers.map((u) => (
              <tr key={u.userId} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Avatar url={u.avatarUrl} name={u.name || u.email} size="md" />
                    <div className="ml-4">
                      <button
                        type="button"
                        onClick={() => setViewUser(u)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
                      >
                        {u.name || 'Unnamed'}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{u.email}</span>
                        {u.employeeId && (
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{u.employeeId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const canEditDept =
                      (isTopTier && u.systemRole !== 'OWNER' && u.systemRole !== 'CEO' && u.systemRole !== 'MD') ||
                      (currentUser?.systemRole === 'ADMIN' && u.systemRole === 'MEMBER')
                    if (canEditDept) {
                      return (
                        <select
                          value={u.department || ''}
                          onChange={(e) => updateDept.mutate({ userId: u.userId, department: e.target.value })}
                          className="rounded-full bg-teal-50 border-0 px-2.5 py-0.5 text-xs font-medium text-teal-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-teal-100 transition-colors"
                        >
                          <option value="">No Dept</option>
                          <option value="Development">Development</option>
                          <option value="Designing">Designing</option>
                          <option value="Management">Management</option>
                          <option value="Research">Research</option>
                        </select>
                      )
                    }
                    return u.department ? (
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                        {u.department}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )
                  })()}
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
                    {isTopTier && u.systemRole !== 'OWNER' && u.systemRole !== 'CEO' && u.systemRole !== 'MD' && (
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
            {displayedUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">

                  {isOwner && activeTab === 'ADMIN'
                    ? 'No admins found. Click "Add User" to create one.'
                    : 'No members found. Click "Add Member" to create one.'}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
            >
              <option value="">-- Select Department --</option>
              <option value="Development">Development</option>
              <option value="Designing">Designing</option>
              <option value="Management">Management</option>
              <option value="Research">Research</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowAddUser(false); setError(''); setNewDepartment('') }}>
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
            This will remove them from Cognito and all project memberships. This action cannot be undone.
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
            {['ADMIN', 'MEMBER'].map((role) => (
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

      {/* User Bio Modal */}
      <Modal
        isOpen={viewUser !== null}
        onClose={() => setViewUser(null)}
        title={viewUser?.name || viewUser?.email || 'User Profile'}
      >
        {viewUser && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar url={viewUser.avatarUrl} name={viewUser.name || viewUser.email} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{viewUser.name || 'Unnamed'}</h3>
                <p className="text-sm text-gray-500">{viewUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={ROLE_COLORS[viewUser.systemRole]}>{viewUser.systemRole}</Badge>
                  {viewUser.employeeId && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-mono font-medium text-gray-700">
                      {viewUser.employeeId}
                    </span>
                  )}
                  {viewUser.designation && (
                    <span className="text-xs text-gray-500">{viewUser.designation}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            {viewUser.bio && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">About</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewUser.bio}</p>
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-gray-900">{viewUser.phone || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Department</p>
                <p className="text-sm font-medium text-gray-900">{viewUser.department || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Location</p>
                <p className="text-sm font-medium text-gray-900">{viewUser.location || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Joined</p>
                <p className="text-sm font-medium text-gray-900">
                  {viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>

            {/* Skills */}
            {viewUser.skills && viewUser.skills.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewUser.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Created By */}
            {viewUser.createdBy && (
              <div className="text-xs text-gray-400">
                Created by {userMap.get(viewUser.createdBy) || viewUser.createdBy}
              </div>
            )}
          </div>
        )}
      </Modal>
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
              <div className="text-2xl font-bold text-gray-900">{progress.totalStats.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{progress.totalStats.TODO}</div>
              <div className="text-xs text-gray-500">To Do</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{progress.totalStats.IN_PROGRESS}</div>
              <div className="text-xs text-gray-500">In Progress</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{progress.totalStats.DONE}</div>
              <div className="text-xs text-gray-500">Done</div>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {progress.projects.map((project) => (
              <div key={project.projectId} className="border rounded-lg p-3">
                <h4 className="font-medium text-gray-900">{project.projectName}</h4>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">{project.stats.TODO} To Do</span>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{project.stats.IN_PROGRESS} In Progress</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">{project.stats.DONE} Done</span>
                </div>
                {project.tasks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {project.tasks.map((task) => (
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
            {progress.projects.length === 0 && (
              <p className="text-gray-500 text-center py-4">No tasks assigned to this user.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
