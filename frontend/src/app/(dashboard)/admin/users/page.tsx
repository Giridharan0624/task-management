'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useUpdateUserRole,
  useUserProgress,
} from '@/lib/hooks/useUsers'
import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useAllDayOffs } from '@/lib/hooks/useDayOffs'
import { useSystemPermission } from '@/lib/hooks/usePermission'
import { useUrlParam } from '@/lib/hooks/useUrlState'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Progress } from '@/components/ui/Progress'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { AlertCircle, UserPlus, Users as UsersIcon } from 'lucide-react'
import { LiveDot } from '@/components/ui/LiveDot'
import {
  UsersToolbar,
  type UsersScope,
  type UsersSort,
} from '@/components/admin/UsersToolbar'
import { UserStatStrip } from '@/components/admin/UserStatStrip'
import { RoleDropdown, ROLE_STYLES } from '@/components/admin/RoleDropdown'
import { UserActionsMenu } from '@/components/admin/UserActionsMenu'
import { BulkImportUsersModal } from '@/components/admin/BulkImportUsersModal'
import { orgsApi } from '@/lib/api/orgsApi'
import { buildCsvName } from '@/lib/utils/csvFilename'
import { getLocalToday } from '@/lib/utils/date'
import type { User } from '@/types/user'
import type { Attendance } from '@/types/attendance'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const systemPerms = useSystemPermission(currentUser?.systemRole)
  const { data: users, isLoading, error: usersError } = useUsers()
  const { data: todayAttendance } = useTodayAttendance()
  const { data: allDayOffs } = useAllDayOffs()
  const createUserMutation = useCreateUser()
  const deleteUserMutation = useDeleteUser()
  const updateRole = useUpdateUserRole()
  const confirm = useConfirm()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [showAddUser, setShowAddUser] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [progressUser, setProgressUser] = useState<string | null>(null)
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useUrlParam<string>('q', '')
  const [deptFilter, setDeptFilter] = useUrlParam<string>('dept', 'ALL')
  const [sortBy, setSortBy] = useUrlParam<UsersSort>('sort', 'name')
  const [error, setError] = useState('')

  const isOwner = currentUser?.systemRole === 'OWNER'
  const [scope, setScope] = useUrlParam<UsersScope>(
    'scope',
    isOwner ? 'management' : 'members'
  )

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('MEMBER')
  const [newDepartment, setNewDepartment] = useState('')
  const [newDateOfJoining, setNewDateOfJoining] = useState('')

  // Online users + attendance-by-userId for "last seen"
  const { onlineUserIds, attendanceByUserId } = useMemo(() => {
    const online = new Set<string>()
    const byId = new Map<string, Attendance>()
    for (const a of todayAttendance ?? []) {
      byId.set(a.userId, a)
      if (a.status === 'SIGNED_IN') online.add(a.userId)
    }
    return { onlineUserIds: online, attendanceByUserId: byId }
  }, [todayAttendance])

  // Scope-filtered users (admin ↔ member toggle).
  // Management covers OWNER + ADMIN — the owner IS management and should
  // appear under this tab, otherwise a fresh workspace reads as empty.
  const allVisibleUsers = useMemo(() => {
    const list = users ?? []
    if (!isOwner) return list.filter((u) => u.systemRole === 'MEMBER')
    return scope === 'management'
      ? list.filter(
          (u) => u.systemRole === 'ADMIN' || u.systemRole === 'OWNER',
        )
      : list.filter((u) => u.systemRole === 'MEMBER')
  }, [users, isOwner, scope])

  // Department list is derived from ALL non-OWNER users so switching scope
  // never makes departments disappear. Counts reflect the current scope —
  // if a department has zero users in the current view it's hidden as noise.
  const departments = useMemo(() => {
    const allRelevant = (users ?? []).filter((u) => u.systemRole !== 'OWNER')
    const allDepts = new Set<string>()
    for (const u of allRelevant) {
      allDepts.add(u.department || 'Unassigned')
    }
    const scopedCount = new Map<string, number>()
    for (const u of allVisibleUsers) {
      const d = u.department || 'Unassigned'
      scopedCount.set(d, (scopedCount.get(d) ?? 0) + 1)
    }
    return Array.from(allDepts)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, count: scopedCount.get(value) ?? 0 }))
      .filter((d) => d.count > 0 || d.value === deptFilter)
  }, [users, allVisibleUsers, deptFilter])

  // Management count includes the OWNER so the Management pill matches
  // the scope filter above (OWNER + ADMIN). Total reflects the whole
  // workspace — never zero while the owner is logged in.
  const adminCount = (users ?? []).filter(
    (u) => u.systemRole === 'ADMIN' || u.systemRole === 'OWNER',
  ).length
  const memberCount = (users ?? []).filter((u) => u.systemRole === 'MEMBER').length
  const onlineCount = (users ?? []).filter((u) =>
    onlineUserIds.has(u.userId)
  ).length
  const totalCount = (users ?? []).length

  // Filter + sort
  const displayedUsers = useMemo(() => {
    let list = allVisibleUsers

    if (deptFilter !== 'ALL') {
      list = list.filter(
        (u) => (u.department || 'Unassigned') === deptFilter
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.designation || '').toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'role')
        return (a.systemRole || '').localeCompare(b.systemRole || '')
      if (sortBy === 'department')
        return (a.department || '').localeCompare(b.department || '')
      if (sortBy === 'joined')
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        )
      return 0
    })
  }, [allVisibleUsers, deptFilter, searchQuery, sortBy])

  const canClear = !!searchQuery || deptFilter !== 'ALL'

  const exportUsersCSV = () => {
    const header = [
      'Name',
      'Email',
      'Employee ID',
      'Role',
      'Department',
      'Designation',
      'Joined',
    ]
    const rows = displayedUsers.map((u) => [
      u.name || '',
      u.email,
      u.employeeId || '',
      u.systemRole,
      u.department || '',
      u.designation || '',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
    ])
    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = buildCsvName('users-export', getLocalToday())
    a.click()
  }

  const creatableRoles = isOwner ? ['ADMIN', 'MEMBER'] : ['MEMBER']

  const handleCreateUser = async () => {
    setError('')
    if (!newEmail || !newName || !newDepartment) {
      setError('All fields are required')
      return
    }
    // Normalize the email so "John@Example.com" and "john@example.com"
    // never produce two separate user records. Keeps behavior consistent
    // with handleSendInvite below, which already lowercases.
    const normalizedEmail = newEmail.trim().toLowerCase()
    if (!/.+@.+\..+/.test(normalizedEmail)) {
      setError('Enter a valid email address')
      return
    }
    try {
      await createUserMutation.mutateAsync({
        email: normalizedEmail,
        name: newName.trim(),
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
      toast.success('User created')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const handleSendInvite = async () => {
    setInviteError('')
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !/.+@.+\..+/.test(email)) {
      setInviteError('Enter a valid email address')
      return
    }
    setInviteSending(true)
    try {
      await orgsApi.sendInvite({ email, roleId: inviteRole })
      toast.success(`Invitation sent to ${email}`)
      setShowInvite(false)
      setInviteEmail('')
      setInviteRole('member')
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteSending(false)
    }
  }

  const handleDelete = async (u: User) => {
    // Short-circuit self-delete — the backend will reject it anyway, but
    // a toast is friendlier than a 403 and avoids a confirm-dialog dance.
    if (u.userId === currentUser?.userId) {
      toast.error("You can't delete your own account.")
      return
    }
    if (u.systemRole === 'OWNER') {
      toast.error("The Owner account can't be deleted from this screen.")
      return
    }
    const confirmed = await confirm({
      title: `Delete ${u.name || u.email}?`,
      description:
        'This removes them from Cognito and all project memberships. This action cannot be undone.',
      confirmLabel: 'Delete user',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await deleteUserMutation.mutateAsync(u.userId)
      toast.success('User deleted')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete user'
      )
    }
  }

  const handleResetMfa = async (u: User) => {
    const confirmed = await confirm({
      title: `Reset 2FA for ${u.name || u.email}?`,
      description:
        "Their TOTP authenticator will be disabled so they can sign in with password alone. They'll be prompted to re-enroll from their profile afterwards.",
      confirmLabel: 'Reset 2FA',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      const { resetUserMfa } = await import('@/lib/api/userApi')
      await resetUserMfa(u.userId)
      toast.success(`2FA reset for ${u.name || u.email}.`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to reset 2FA.',
      )
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateRole.mutateAsync({ userId, systemRole: role })
      toast.success(`Role updated to ${role}`)
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update role'
      )
    }
  }

  if (!systemPerms.canManageUsers) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Surface API errors explicitly — previously the page rendered empty
  // whenever /users failed, making "fetch broken" look like "no users".
  if (usersError) {
    return (
      <div className="mx-auto w-full max-w-4xl py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load users:{' '}
            {usersError instanceof Error ? usersError.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const userMap = new Map(
    (users ?? []).map((u) => [u.userId, u.name || u.email])
  )
  if (currentUser)
    userMap.set(currentUser.userId, currentUser.name || currentUser.email)

  // Subtitle label matches the scope pill: "management" covers OWNER +
  // ADMIN, "members" covers MEMBER. Plural-s handled for the 0/1 cases.
  const pageDescription = isOwner
    ? `${displayedUsers.length} ${scope === 'management' ? 'in management' : `member${displayedUsers.length === 1 ? '' : 's'}`}${onlineCount > 0 ? ` · ${onlineCount} online now` : ''}`
    : `${displayedUsers.length} member${displayedUsers.length === 1 ? '' : 's'}${onlineCount > 0 ? ` · ${onlineCount} online now` : ''}`

  return (
    <div className="flex w-full max-w-7xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title={isOwner ? 'User Management' : 'Member Management'}
        description={pageDescription}
      />

      <UserStatStrip
        total={totalCount}
        management={adminCount}
        members={memberCount}
        online={onlineCount}
        showManagement={isOwner}
      />

      <UsersToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        scope={scope}
        onScopeChange={setScope}
        showScopeToggle={isOwner}
        managementCount={adminCount}
        memberCount={memberCount}
        deptFilter={deptFilter}
        onDeptFilterChange={setDeptFilter}
        departments={departments}
        sort={sortBy}
        onSortChange={setSortBy}
        canClear={canClear}
        onClear={() => {
          setSearchQuery('')
          setDeptFilter('ALL')
        }}
        onExportCSV={exportUsersCSV}
        onAddUser={() => setShowAddUser(true)}
        onInvite={isOwner ? () => setShowInvite(true) : undefined}
        onBulkImport={isOwner ? () => setShowBulkImport(true) : undefined}
        addLabel={isOwner ? 'Add user' : 'Add member'}
      />

      {displayedUsers.length === 0 ? (
        <EmptyState
          icon={
            <UsersIcon
              className="h-7 w-7 text-muted-foreground/70"
              strokeWidth={1.5}
            />
          }
          title={canClear ? 'No users match your filters' : 'No users yet'}
          description={
            canClear
              ? 'Try clearing filters or switching scope.'
              : `Invite teammates by email, or create them directly from here.`
          }
          action={
            !canClear ? (
              <div className="flex gap-2">
                <Button onClick={() => setShowAddUser(true)}>
                  <UserPlus className="h-3.5 w-3.5" />
                  {isOwner ? 'Add user' : 'Add member'}
                </Button>
                {isOwner && (
                  <Button
                    variant="secondary"
                    onClick={() => setShowInvite(true)}
                  >
                    Send invite
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('')
                  setDeptFilter('ALL')
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/30">
                <tr>
                  <Th>User</Th>
                  <Th>Department</Th>
                  <Th>Role</Th>
                  <Th>Last seen</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card stagger-up">
                {displayedUsers.map((u) => {
                  const att = attendanceByUserId.get(u.userId)
                  const isOnline = onlineUserIds.has(u.userId)
                  const canDelete =
                    u.systemRole !== 'OWNER' &&
                    u.userId !== currentUser?.userId &&
                    (isOwner ||
                      (currentUser?.systemRole === 'ADMIN' &&
                        u.systemRole === 'MEMBER'))

                  return (
                    <tr
                      key={u.userId}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setViewUser(u)}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="relative">
                            <Avatar
                              url={u.avatarUrl}
                              name={u.name || u.email}
                              size="md"
                            />
                            {isOnline && (
                              // Explicit size + direct fill — the old
                              // wrapper inherited its box from <LiveDot>
                              // whose `animate-ping` element perturbed
                              // the bounding box, so the ring rendered
                              // as a visible slash across the avatar
                              // edge. A fixed-size circle + its own
                              // background is reliable and cheap.
                              <span
                                aria-label="Online"
                                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground hover:text-primary">
                              {u.name || 'Unnamed'}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[11px] text-muted-foreground">
                                {u.email}
                              </span>
                              {u.employeeId && (
                                <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                                  {u.employeeId}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {u.department ? (
                          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                            {u.department}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <RoleDropdown
                          role={u.systemRole}
                          onChange={(r) => handleRoleChange(u.userId, r)}
                          disabled={!isOwner || u.systemRole === 'OWNER'}
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs">
                        <LastSeenCell
                          isOnline={isOnline}
                          attendance={att}
                          joinedAt={u.createdAt}
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <UserActionsMenu
                          onViewProfile={() => setViewUser(u)}
                          onViewProgress={() => setProgressUser(u.userId)}
                          onDelete={canDelete ? () => handleDelete(u) : undefined}
                          onResetMfa={
                            isOwner && u.userId !== currentUser?.userId
                              ? () => handleResetMfa(u)
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUser}
        onClose={() => {
          setShowAddUser(false)
          setError('')
        }}
        title={isOwner ? 'Create new user' : 'Create new member'}
      >
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Input
            label="Email"
            type="text"
            placeholder="user@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="new-email-address"
            name="new-user-email-field"
          />
          <Input
            label="Name"
            type="text"
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoComplete="new-user-name"
            name="new-user-name-field"
          />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Role
            </label>
            <Select
              value={newRole}
              onChange={setNewRole}
              options={creatableRoles.map((r) => ({ value: r, label: r }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Department
            </label>
            <Select
              value={newDepartment}
              onChange={setNewDepartment}
              placeholder="Select department"
              options={[
                { value: 'Development', label: 'Development' },
                { value: 'Designing', label: 'Designing' },
                { value: 'Management', label: 'Management' },
                { value: 'Research', label: 'Research' },
              ]}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Date of joining
            </label>
            <DatePicker
              value={newDateOfJoining}
              onChange={setNewDateOfJoining}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select joining date"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddUser(false)
                setError('')
                setNewDepartment('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              loading={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create user'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite by email Modal */}
      <Modal
        isOpen={showInvite}
        onClose={() => {
          setShowInvite(false)
          setInviteError('')
        }}
        title="Invite teammate by email"
      >
        <div className="space-y-4">
          {inviteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            They&apos;ll get an email link to choose their own password. They
            fill in their own department and other profile details after
            joining.
          </p>
          <Input
            label="Email"
            type="email"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoComplete="off"
          />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Role
            </label>
            <Select
              value={inviteRole}
              onChange={(v) => setInviteRole(v as 'admin' | 'member')}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowInvite(false)
                setInviteError('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendInvite}
              loading={inviteSending}
            >
              {inviteSending ? 'Sending...' : 'Send invite'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Progress Modal */}
      {progressUser && (
        <UserProgressModal
          userId={progressUser}
          onClose={() => setProgressUser(null)}
        />
      )}

      {/* User Bio Modal */}
      <Modal
        isOpen={viewUser !== null}
        onClose={() => setViewUser(null)}
        title={viewUser?.name || viewUser?.email || 'User profile'}
      >
        {viewUser && (
          <UserBioContent
            viewUser={viewUser}
            allDayOffs={allDayOffs ?? []}
            userMap={userMap}
          />
        )}
      </Modal>

      <BulkImportUsersModal
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onComplete={() => {
          // Trigger a user-list refetch so the newly-created rows show
          // up in the table without a manual reload.
          void queryClient.invalidateQueries({ queryKey: ['users'] })
        }}
      />
    </div>
  )
}

/* ─── Helpers ─── */

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${className}`}
    >
      {children}
    </th>
  )
}

function LastSeenCell({
  isOnline,
  attendance,
  joinedAt,
}: {
  isOnline: boolean
  attendance?: Attendance
  joinedAt?: string
}) {
  if (isOnline && attendance?.currentSignInAt) {
    const elapsed = Math.max(
      0,
      (Date.now() - new Date(attendance.currentSignInAt).getTime()) / 60000
    )
    const label =
      elapsed < 60
        ? `${Math.floor(elapsed)}m`
        : `${Math.floor(elapsed / 60)}h ${Math.floor(elapsed % 60)}m`
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700">
        <LiveDot size="xs" />
        <span className="font-semibold">Active · {label}</span>
      </span>
    )
  }
  if (attendance && attendance.sessions.length > 0) {
    const last = attendance.sessions[attendance.sessions.length - 1]
    const t = last.signOutAt
      ? new Date(last.signOutAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
    return <span className="text-muted-foreground">Today · {t}</span>
  }
  if (joinedAt) {
    return (
      <span className="text-muted-foreground">
        Joined{' '}
        {new Date(joinedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    )
  }
  return <span className="text-muted-foreground">—</span>
}

function UserBioContent({
  viewUser,
  allDayOffs,
  userMap,
}: {
  viewUser: User
  allDayOffs: { userId: string; status: string; startDate: string; endDate: string }[]
  userMap: Map<string, string>
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar
          url={viewUser.avatarUrl}
          name={viewUser.name || viewUser.email}
          size="lg"
        />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground">
            {viewUser.name || 'Unnamed'}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {viewUser.email}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge className={ROLE_STYLES[viewUser.systemRole]}>
              {viewUser.systemRole}
            </Badge>
            {viewUser.employeeId && (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-medium text-foreground/85">
                {viewUser.employeeId}
              </span>
            )}
            {viewUser.designation && (
              <span className="text-xs text-muted-foreground">
                {viewUser.designation}
              </span>
            )}
          </div>
        </div>
      </div>

      {viewUser.bio && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            About
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {viewUser.bio}
          </p>
        </div>
      )}

      {/* Day-Off score */}
      {viewUser.systemRole !== 'OWNER' &&
        (() => {
          const now = new Date()
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
          let daysOff = 0
          for (const d of allDayOffs) {
            if (d.userId !== viewUser.userId || d.status !== 'APPROVED') continue
            const start = d.startDate.slice(0, 10)
            const end = d.endDate.slice(0, 10)
            if (start > monthEnd || end < monthStart) continue
            const from = new Date(
              Math.max(
                new Date(start).getTime(),
                new Date(monthStart).getTime()
              )
            )
            const to = new Date(
              Math.min(new Date(end).getTime(), new Date(monthEnd).getTime())
            )
            daysOff +=
              Math.round(
                (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
              ) + 1
          }
          const score =
            daysOff === 0
              ? 100
              : daysOff <= 2
                ? 75
                : daysOff <= 5
                  ? 50
                  : 25
          const tone =
            score === 100
              ? { c: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
              : score >= 75
                ? { c: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' }
                : score >= 50
                  ? { c: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
                  : { c: 'text-red-600', bg: 'bg-red-50 border-red-200' }
          const label =
            score === 100
              ? 'Excellent'
              : score >= 75
                ? 'Good'
                : score >= 50
                  ? 'Average'
                  : 'Low'
          const monthName = now.toLocaleDateString('en-US', { month: 'long' })

          return (
            <div className={`rounded-xl border p-3.5 ${tone.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Day-off score · {monthName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xl font-bold tabular-nums ${tone.c}`}
                    >
                      {score}
                    </span>
                    <span className={`text-[11px] font-semibold ${tone.c}`}>
                      {label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">
                    {daysOff} day{daysOff !== 1 ? 's' : ''} off
                  </p>
                </div>
              </div>
            </div>
          )
        })()}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 stagger-up">
        <DetailTile label="Phone" value={viewUser.phone} />
        <DetailTile label="Department" value={viewUser.department} />
        <DetailTile label="Location" value={viewUser.location} />
        {viewUser.dateOfBirth && (
          <DetailTile
            label="Date of birth"
            value={new Date(
              viewUser.dateOfBirth + 'T00:00:00'
            ).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          />
        )}
        {viewUser.collegeName && (
          <DetailTile label="College" value={viewUser.collegeName} />
        )}
        {viewUser.areaOfInterest && (
          <DetailTile label="Area of interest" value={viewUser.areaOfInterest} />
        )}
        {viewUser.hobby && <DetailTile label="Hobby" value={viewUser.hobby} />}
        <DetailTile
          label="Joined"
          value={
            viewUser.createdAt
              ? new Date(viewUser.createdAt).toLocaleDateString()
              : undefined
          }
        />
      </div>

      {viewUser.skills && viewUser.skills.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {viewUser.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {viewUser.createdBy && (
        <div className="text-xs text-muted-foreground">
          Created by {userMap.get(viewUser.createdBy) || viewUser.createdBy}
        </div>
      )}
    </div>
  )
}

function DetailTile({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

function UserProgressModal({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const { data: progress, isLoading } = useUserProgress(userId)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Progress: ${progress?.user?.name || progress?.user?.email || 'Loading...'}`}
      size="lg"
    >
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : progress ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3 stagger-up">
            <ProgressStat
              label="Total"
              value={progress.totalStats.total}
              accent="text-foreground"
              tone="bg-muted/40"
            />
            <ProgressStat
              label="To Do"
              value={progress.totalStats.TODO}
              accent="text-amber-700"
              tone="bg-amber-50 border-amber-200"
            />
            <ProgressStat
              label="In Progress"
              value={progress.totalStats.IN_PROGRESS}
              accent="text-blue-700"
              tone="bg-blue-50 border-blue-200"
            />
            <ProgressStat
              label="Done"
              value={progress.totalStats.DONE}
              accent="text-emerald-700"
              tone="bg-emerald-50 border-emerald-200"
            />
          </div>

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {progress.projects.map((project) => {
              const total =
                project.stats.TODO +
                project.stats.IN_PROGRESS +
                project.stats.DONE
              const pct = total > 0 ? (project.stats.DONE / total) * 100 : 0
              return (
                <div
                  key={project.projectId}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="truncate text-sm font-bold text-foreground">
                      {project.projectName}
                    </h4>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                      {project.stats.DONE}/{total} done
                    </span>
                  </div>
                  <Progress value={pct} className="mb-2 h-1.5" />
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {project.stats.TODO} to do
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {project.stats.IN_PROGRESS} in progress
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {project.stats.DONE} done
                    </span>
                  </div>
                  {project.tasks.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                      {project.tasks.map((task) => (
                        <li
                          key={task.taskId}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate text-foreground/90">
                            {task.title}
                          </span>
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              task.status === 'DONE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {progress.projects.length === 0 && (
              <EmptyState
                title="No tasks assigned"
                description="This user hasn't been assigned to any tasks yet."
                className="border-0"
              />
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function ProgressStat({
  label,
  value,
  accent,
  tone,
}: {
  label: string
  value: number
  accent: string
  tone: string
}) {
  return (
    <div className={`rounded-lg border border-transparent p-3 text-center ${tone}`}>
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  )
}
