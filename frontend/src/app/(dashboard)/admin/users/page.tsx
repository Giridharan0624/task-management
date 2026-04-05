'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRole, useUpdateUserDepartment, useUserProgress } from '@/lib/hooks/useUsers'
import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { Avatar } from '@/components/ui/AvatarUpload'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { useAllDayOffs } from '@/lib/hooks/useDayOffs'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
}

type TabType = 'ADMIN' | 'MEMBER'
type SortOption = 'name' | 'role' | 'department' | 'joined'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const systemPerms = useSystemPermission(currentUser?.systemRole)
  const { data: users, isLoading } = useUsers()
  const { data: todayAttendance } = useTodayAttendance()
  const { data: allDayOffs } = useAllDayOffs()
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
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('ADMIN')

  // Online users (currently signed in)
  const onlineUserIds = useMemo(() => {
    const set = new Set<string>()
    for (const a of todayAttendance ?? []) { if (a.status === 'SIGNED_IN') set.add(a.userId) }
    return set
  }, [todayAttendance])

  // Department counts
  const deptCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const u of users ?? []) { const d = u.department || 'Unassigned'; map.set(d, (map.get(d) ?? 0) + 1) }
    return map
  }, [users])

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('MEMBER')
  const [newDepartment, setNewDepartment] = useState('')
  const [newDateOfJoining, setNewDateOfJoining] = useState('')

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

  const isTopTier = currentUser?.systemRole === 'OWNER'
  const isOwner = currentUser?.systemRole === 'OWNER'

  // Build a userId -> name map for resolving "created by"
  const userMap = new Map((users ?? []).map((u) => [u.userId, u.name || u.email]))
  if (currentUser) userMap.set(currentUser.userId, currentUser.name || currentUser.email)

  // Filter users by role groups
  const adminsOnly = (users ?? []).filter((u) => u.systemRole === 'ADMIN')
  const members = (users ?? []).filter((u) => u.systemRole === 'MEMBER')

  const rawDisplayedUsers = isTopTier
    ? (activeTab === 'ADMIN' ? adminsOnly : members)
    : members

  const deptFiltered = deptFilter === 'ALL'
    ? rawDisplayedUsers
    : rawDisplayedUsers.filter((u) => (u.department || '').toLowerCase() === deptFilter.toLowerCase())

  const searched = searchQuery.trim()
    ? deptFiltered.filter((u) => {
        const q = searchQuery.toLowerCase()
        return (u.name || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q)
          || (u.designation || '').toLowerCase().includes(q)
          || (u.department || '').toLowerCase().includes(q)
      })
    : deptFiltered

  const displayedUsers = [...searched].sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
    if (sortBy === 'role') return (a.systemRole || '').localeCompare(b.systemRole || '')
    if (sortBy === 'department') return (a.department || '').localeCompare(b.department || '')
    if (sortBy === 'joined') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    return 0
  })

  const onlineCount = (users ?? []).filter(u => onlineUserIds.has(u.userId)).length

  // CSV export
  const exportUsersCSV = () => {
    const header = ['Name', 'Email', 'Employee ID', 'Role', 'Department', 'Designation', 'Joined']
    const rows = displayedUsers.map(u => [u.name || '', u.email, u.employeeId || '', u.systemRole, u.department || '', u.designation || '', u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''])
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'users-export.csv'; a.click()
  }

  // Available roles for creation based on caller
  const creatableRoles = isOwner
    ? ['ADMIN', 'MEMBER']
    : ['MEMBER']

  const handleCreateUser = async () => {
    setError('')
    if (!newEmail || !newName || !newDepartment) {
      setError('All fields are required')
      return
    }
    try {
      await createUserMutation.mutateAsync({
        email: newEmail,
        name: newName,
        systemRole: newRole,
        department: newDepartment,
        dateOfJoining: newDateOfJoining,
      })
      setShowAddUser(false)
      setNewEmail('')
      setNewName('')
      setNewRole('MEMBER')
      setNewDepartment('')
      setNewDateOfJoining('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    try {
      await deleteUserMutation.mutateAsync(deleteTarget.userId)
      setDeleteTarget(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateRole.mutateAsync({ userId, systemRole: role })
      setSelectedUser(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            {isTopTier ? 'User Management' : 'Member Management'}
          </h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {displayedUsers.length} user{displayedUsers.length !== 1 ? 's' : ''}{onlineCount > 0 ? ` · ${onlineCount} online` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportUsersCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            CSV
          </button>
          <button onClick={() => setShowAddUser(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-gray-800 transition-all shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Add {isTopTier ? 'User' : 'Member'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xl font-bold text-indigo-700 tabular-nums">{(users ?? []).filter(u => u.systemRole !== 'OWNER').length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Total</p>
        </div>
        {isTopTier && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xl font-bold text-violet-700 tabular-nums">{adminsOnly.length}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Management</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xl font-bold text-blue-700 tabular-nums">{members.length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Members</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{onlineCount}</p>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Online Now</p>
        </div>
      </div>

      {/* Search + Sort + Department filter */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-[12px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-all" />
          </div>
          <FilterSelect value={sortBy} onChange={v => setSortBy(v as SortOption)}
            options={[{ value: 'name', label: 'Sort: Name' }, { value: 'role', label: 'Sort: Role' }, { value: 'department', label: 'Sort: Department' }, { value: 'joined', label: 'Sort: Newest' }]} />
          <FilterSelect value={deptFilter} onChange={setDeptFilter} active={deptFilter !== 'ALL'}
            options={[{ value: 'ALL', label: 'All Departments' }, ...Array.from(deptCounts.entries()).sort().map(([dept, count]) => ({ value: dept, label: `${dept} (${count})` }))]} />
          {(searchQuery || deptFilter !== 'ALL') && (
            <button onClick={() => { setSearchQuery(''); setDeptFilter('ALL') }} className="text-[11px] text-gray-400 hover:text-gray-600 font-medium">Clear</button>
          )}
        </div>
      </div>

      {/* Tabs (Owner only) */}
      {isTopTier && (
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'ADMIN'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Management ({adminsOnly.length})
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/60">
            <tr>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Department</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Role</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Created By</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Joined</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {displayedUsers.map((u) => (
              <tr key={u.userId} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="relative">
                      <Avatar url={u.avatarUrl} name={u.name || u.email} size="md" />
                      {onlineUserIds.has(u.userId) && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                    </div>
                    <div className="ml-3">
                      <button type="button" onClick={() => setViewUser(u)}
                        className="text-[13px] font-semibold text-gray-800 hover:text-indigo-600 text-left transition-colors">
                        {u.name || 'Unnamed'}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">{u.email}</span>
                        {u.employeeId && (
                          <span className="text-[9px] font-mono bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{u.employeeId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
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
                  {u.createdBy ? (userMap.get(u.createdBy) || '—') : '—'}
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
                        const canDelete = currentUser?.systemRole === 'OWNER' || (currentUser?.systemRole === 'ADMIN' && u.systemRole === 'MEMBER')
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
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">

                  {isTopTier && activeTab === 'ADMIN'
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
              type="text"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="new-email-address"
              name="new-user-email-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoComplete="new-user-name"
              name="new-user-name-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <Select
              value={newRole}
              onChange={setNewRole}
              options={creatableRoles.map((r) => ({ value: r, label: r }))}
            />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <Select
                value={newDepartment}
                onChange={setNewDepartment}
                placeholder="Select Department"
                options={[
                  { value: 'Development', label: 'Development' },
                  { value: 'Designing', label: 'Designing' },
                  { value: 'Management', label: 'Management' },
                  { value: 'Research', label: 'Research' },
                ]}
              />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
            <DatePicker
              value={newDateOfJoining}
              onChange={setNewDateOfJoining}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select joining date"
            />
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
        title={`Change Role`}
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar url={selectedUser?.avatarUrl} name={selectedUser?.name || selectedUser?.email || ''} size="md" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedUser?.name || selectedUser?.email}</p>
              <p className="text-xs text-gray-400">Current: <Badge className={ROLE_COLORS[selectedUser?.systemRole ?? 'MEMBER']}>{selectedUser?.systemRole}</Badge></p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Select new role</p>
            <div className="grid grid-cols-2 gap-2">
              {['ADMIN', 'MEMBER'].map((role) => {
                const isActive = selectedUser?.systemRole === role
                return (
                  <button
                    key={role}
                    onClick={() => selectedUser && handleRoleChange(selectedUser.userId, role)}
                    disabled={updateRole.isPending}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {role}
                  </button>
                )
              })}
            </div>
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

            {/* Day-Off Score — only for ADMIN and MEMBER */}
            {viewUser.systemRole !== 'OWNER' && (() => {
              const now = new Date()
              const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
              const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
              let daysOff = 0
              for (const d of allDayOffs ?? []) {
                if (d.userId !== viewUser.userId || d.status !== 'APPROVED') continue
                const start = d.startDate.slice(0, 10)
                const end = d.endDate.slice(0, 10)
                if (start > monthEnd || end < monthStart) continue
                const from = new Date(Math.max(new Date(start).getTime(), new Date(monthStart).getTime()))
                const to = new Date(Math.min(new Date(end).getTime(), new Date(monthEnd).getTime()))
                daysOff += Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
              }
              const score = daysOff === 0 ? 100 : daysOff <= 2 ? 75 : daysOff <= 5 ? 50 : 25
              const scoreColor = score === 100 ? 'text-emerald-600' : score >= 75 ? 'text-blue-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
              const scoreBg = score === 100 ? 'bg-emerald-50 border-emerald-200' : score >= 75 ? 'bg-blue-50 border-blue-200' : score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
              const scoreLabel = score === 100 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Average' : 'Low'
              const monthName = now.toLocaleDateString('en-US', { month: 'long' })

              return (
                <div className={`rounded-xl border p-3.5 ${scoreBg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Day-Off Score · {monthName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
                        <span className={`text-[11px] font-semibold ${scoreColor}`}>{scoreLabel}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-gray-500">{daysOff} day{daysOff !== 1 ? 's' : ''} off</p>
                    </div>
                  </div>
                </div>
              )
            })()}

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
              {viewUser.dateOfBirth && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Date of Birth</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(viewUser.dateOfBirth + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              )}
              {viewUser.collegeName && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">College</p>
                  <p className="text-sm font-medium text-gray-900">{viewUser.collegeName}</p>
                </div>
              )}
              {viewUser.areaOfInterest && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Area of Interest</p>
                  <p className="text-sm font-medium text-gray-900">{viewUser.areaOfInterest}</p>
                </div>
              )}
              {viewUser.hobby && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">Hobby</p>
                  <p className="text-sm font-medium text-gray-900">{viewUser.hobby}</p>
                </div>
              )}
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
