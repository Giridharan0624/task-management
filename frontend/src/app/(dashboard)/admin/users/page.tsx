'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useUpdateUserRole,
  useUserProgress,
} from '@/lib/hooks/useUsers'
import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useAllDayOffs } from '@/lib/hooks/useDayOffs'
import { useSystemPermission, useHasPermission } from '@/lib/hooks/usePermission'
import { useRoles } from '@/lib/hooks/useRoles'
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
import { buildCsvName } from '@/lib/utils/csvFilename'
import { getLocalToday } from '@/lib/utils/date'
import type { User } from '@/types/user'
import type { Attendance } from '@/types/attendance'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { current: currentOrg } = useTenant()
  const systemPerms = useSystemPermission(currentUser?.systemRole)
  const { data: users, isLoading, error: usersError } = useUsers()
  const { data: todayAttendance } = useTodayAttendance()
  const { data: allDayOffs } = useAllDayOffs()
  // System-scope roles defined on the tenant (OWNER/ADMIN/MEMBER plus
  // any custom roles the tenant created in /settings/roles). Powers
  // the role dropdowns, the invite role picker, and the management-tier
  // classifier below.
  const { roles: systemRoles } = useRoles({ scope: 'system' })
  // Per-affordance permission gates. Live, with the hardcoded fallback
  // during the initial /orgs/current/roles fetch (returns null while
  // loading; we coerce to the legacy isPrivileged behavior).
  const legacyIsPrivileged =
    currentUser?.systemRole === 'OWNER' || currentUser?.systemRole === 'ADMIN'
  const canCreateUserPerm = useHasPermission('user.create')
  const canCreateUser =
    canCreateUserPerm === null ? legacyIsPrivileged : canCreateUserPerm
  const createUserMutation = useCreateUser()
  const deleteUserMutation = useDeleteUser()
  const updateRole = useUpdateUserRole()
  const confirm = useConfirm()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [showAddUser, setShowAddUser] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
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

  // Department choices for the Add user form — sourced from the OWNER-
  // managed catalog in /settings/organization. Falls back to an empty
  // list when settings haven't loaded yet (the Select will show its
  // placeholder until they do).
  const departmentOptions = useMemo(
    () =>
      (currentOrg?.settings?.departments ?? []).map((name) => ({
        value: name,
        label: name,
      })),
    [currentOrg?.settings?.departments]
  )

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

  // "Management" = roles that can administer users / roles. Session 8
  // replaces the hardcoded OWNER/ADMIN check with a permission-derived
  // set: any tenant-defined system role whose permissions include
  // `user.role.manage` or `role.manage` counts as management. Owner +
  // Admin are kept as a baseline so the tab works even when the caller
  // can't see other roles' permissions (ADMIN viewing this page gets
  // redacted perms for non-own roles — see list_roles handler).
  const privilegedRoleIds = useMemo(() => {
    const ids = new Set<string>(['owner', 'admin'])
    for (const r of systemRoles) {
      if (
        r.permissions.includes('user.role.manage') ||
        r.permissions.includes('role.manage')
      ) {
        ids.add(r.roleId.toLowerCase())
      }
    }
    return ids
  }, [systemRoles])

  const isPrivilegedUser = useMemo(() => {
    return (u: User) => privilegedRoleIds.has((u.systemRole || '').toLowerCase())
  }, [privilegedRoleIds])

  // Scope-filtered users (management ↔ members toggle). Non-OWNER
  // callers only see regular (non-management) users because they can't
  // edit admins anyway.
  const allVisibleUsers = useMemo(() => {
    const list = users ?? []
    if (!isOwner) return list.filter((u) => !isPrivilegedUser(u))
    return scope === 'management'
      ? list.filter((u) => isPrivilegedUser(u))
      : list.filter((u) => !isPrivilegedUser(u))
  }, [users, isOwner, scope, isPrivilegedUser])

  // Department list is derived from ALL non-OWNER users so switching scope
  // never makes departments disappear. Counts reflect the current scope —
  // if a department has zero users in the current view it's hidden as noise.
  const departments = useMemo(() => {
    const allRelevant = (users ?? []).filter(
      (u) => (u.systemRole || '').toUpperCase() !== 'OWNER',
    )
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

  // Counts for the scope pills. Management uses the privileged set so
  // custom admin-tier roles get counted correctly.
  const adminCount = (users ?? []).filter((u) => isPrivilegedUser(u)).length
  const memberCount = (users ?? []).filter((u) => !isPrivilegedUser(u)).length
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

  // Assignable system roles — OWNER is excluded (transfer-ownership is
  // a separate flow). When the roles fetch hasn't arrived yet, fall back
  // to the two built-in tiers so the Add User modal is never blank on
  // first paint. Admins can only create non-privileged roles; owners
  // can assign any assignable role including custom admin-tier ones.
  const assignableRoles = useMemo(() => {
    if (systemRoles.length === 0) {
      return [
        { roleId: 'ADMIN', name: 'Admin' },
        { roleId: 'MEMBER', name: 'Member' },
      ]
    }
    return systemRoles
      .filter((r) => r.roleId.toLowerCase() !== 'owner')
      .map((r) => {
        // Built-in tiers keep their uppercase stored form so the
        // request body matches what the backend expects (ADMIN/MEMBER);
        // custom roles send their canonical lowercase role_id.
        const id = ['admin', 'member'].includes(r.roleId.toLowerCase())
          ? r.roleId.toUpperCase()
          : r.roleId
        return { roleId: id, name: r.name || r.roleId }
      })
  }, [systemRoles])

  const creatableRoles = useMemo(() => {
    // Admins can create Members and other non-privileged custom roles,
    // but never anything in the privileged (admin-tier) set — that's
    // reserved for the OWNER. This preserves the pre-Session-8 rule
    // ("admins can create admins or members") at the owner level while
    // preventing an admin from elevating via a custom role sidestep.
    if (isOwner) return assignableRoles
    return assignableRoles.filter(
      (r) => !privilegedRoleIds.has(r.roleId.toLowerCase()),
    )
  }, [assignableRoles, isOwner, privilegedRoleIds])

  const handleCreateUser = async () => {
    setError('')
    if (!newEmail || !newName || !newDepartment) {
      setError('All fields are required')
      return
    }
    // Normalize the email so "John@Example.com" and "john@example.com"
    // never produce two separate user records.
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

  const handleDelete = async (u: User) => {
    // Short-circuit self-delete — the backend will reject it anyway, but
    // a toast is friendlier than a 403 and avoids a confirm-dialog dance.
    if (u.userId === currentUser?.userId) {
      toast.error("You can't delete your own account.")
      return
    }
    if ((u.systemRole || '').toUpperCase() === 'OWNER') {
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

  // Page entry is gated by the parent AdminLayout, which checks
  // `user.list`. We don't add a second `canManageUsers` gate here —
  // doing so would deny entry to read-only roles like a custom
  // `tester` whose permissions include user.list but not create or
  // delete. Mutation affordances inside the page (Add User, Role
  // dropdown, delete) are individually permission-gated below, so a
  // list-only caller sees the table without the action buttons.

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
        onAddUser={canCreateUser ? () => setShowAddUser(true) : undefined}
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
              : 'Add teammates so they can sign in and start working.'
          }
          action={
            !canClear ? (
              <Button onClick={() => setShowAddUser(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                {isOwner ? 'Add user' : 'Add member'}
              </Button>
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
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-none">
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
              <tbody className="divide-y divide-border/60 bg-card">
                {displayedUsers.map((u) => {
                  const att = attendanceByUserId.get(u.userId)
                  const isOnline = onlineUserIds.has(u.userId)
                  const targetIsOwner = (u.systemRole || '').toUpperCase() === 'OWNER'
                  const targetIsPrivileged = isPrivilegedUser(u)
                  // Any admin-tier caller (built-in ADMIN or a custom
                  // privileged role) can delete non-privileged users;
                  // OWNER can delete anyone except themselves.
                  const callerIsPrivileged = currentUser
                    ? privilegedRoleIds.has(
                        (currentUser.systemRole || '').toLowerCase(),
                      )
                    : false
                  const canDelete =
                    !targetIsOwner &&
                    u.userId !== currentUser?.userId &&
                    (isOwner ||
                      (callerIsPrivileged && !targetIsPrivileged))

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
                          <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                            {u.department}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">
                            —
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <RoleDropdown
                          role={u.systemRole}
                          onChange={(r) => handleRoleChange(u.userId, r)}
                          disabled={
                            // canManageAdmins is permission-driven (`user.role.manage`).
                            // Backend agrees — UpdateUserRoleUseCase gates on the same
                            // permission. The OWNER role itself stays immutable.
                            !systemPerms.canManageAdmins ||
                            (u.systemRole || '').toUpperCase() === 'OWNER'
                          }
                          roles={assignableRoles}
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
              options={creatableRoles.map((r) => ({
                value: r.roleId,
                label: r.name,
              }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">
              Department
            </label>
            <Select
              value={newDepartment}
              onChange={setNewDepartment}
              placeholder={
                departmentOptions.length === 0
                  ? 'No departments configured'
                  : 'Select department'
              }
              options={departmentOptions}
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
      className={`px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground ${className}`}
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

/**
 * Resolve a user's role_id to the human-readable label defined in the
 * tenant's role record. Falls back to the role_id itself when the
 * record is missing (e.g. the role was renamed or deleted while the
 * user was still assigned) so the badge never renders blank.
 */
function roleLabel(roleId: string, systemRoles: { roleId: string; name: string }[]): string {
  const match = systemRoles.find(
    (r) => r.roleId.toLowerCase() === (roleId || '').toLowerCase(),
  )
  return (match?.name || roleId || '').trim()
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
  // Pull roles inline — useQuery dedupes, so this hits the same cached
  // response the parent page loaded instead of a new request.
  const { roles: systemRoles } = useRoles({ scope: 'system' })
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
              {roleLabel(viewUser.systemRole, systemRoles)}
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
      {(viewUser.systemRole || '').toUpperCase() !== 'OWNER' &&
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
              ? { ink: 'text-emerald-700', dot: 'bg-emerald-500' }
              : score >= 75
                ? { ink: 'text-sky-700', dot: 'bg-sky-500' }
                : score >= 50
                  ? { ink: 'text-amber-700', dot: 'bg-amber-500' }
                  : { ink: 'text-rose-700', dot: 'bg-rose-500' }
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
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Day-off score · {monthName}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span
                      className={`text-2xl font-medium tabular-nums leading-none ${tone.ink}`}
                    >
                      {score}
                    </span>
                    <span className={`text-[11px] font-medium ${tone.ink}`}>
                      {label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Days off
                  </p>
                  <p className="mt-1 text-2xl font-medium leading-none tabular-nums text-foreground">
                    {daysOff}
                  </p>
                </div>
              </div>
            </div>
          )
        })()}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-4 gap-3">
            <ProgressStat
              label="Total"
              value={progress.totalStats.total}
              accent="text-foreground"
              dot="bg-slate-400"
            />
            <ProgressStat
              label="To Do"
              value={progress.totalStats.TODO}
              accent="text-amber-700"
              dot="bg-amber-500"
            />
            <ProgressStat
              label="In Progress"
              value={progress.totalStats.IN_PROGRESS}
              accent="text-sky-700"
              dot="bg-sky-500"
            />
            <ProgressStat
              label="Done"
              value={progress.totalStats.DONE}
              accent="text-emerald-700"
              dot="bg-emerald-500"
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
                  className="rounded-md border border-border/70 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="truncate text-sm font-medium text-foreground">
                      {project.projectName}
                    </h4>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {project.stats.DONE}/{total} done
                    </span>
                  </div>
                  <Progress value={pct} className="mb-3 h-1" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {project.stats.TODO} to do
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sky-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      {project.stats.IN_PROGRESS} in progress
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {project.stats.DONE} done
                    </span>
                  </div>
                  {project.tasks.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
                      {project.tasks.map((task) => {
                        const dot =
                          task.status === 'DONE'
                            ? 'bg-emerald-500'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-sky-500'
                              : 'bg-amber-500'
                        const ink =
                          task.status === 'DONE'
                            ? 'text-emerald-700'
                            : task.status === 'IN_PROGRESS'
                              ? 'text-sky-700'
                              : 'text-amber-700'
                        return (
                          <li
                            key={task.taskId}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="truncate text-foreground/85">
                              {task.title}
                            </span>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] ${ink}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                              {task.status.replace('_', ' ')}
                            </span>
                          </li>
                        )
                      })}
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
  dot,
}: {
  label: string
  value: number
  accent: string
  /** Status dot color (e.g. `bg-amber-500`) — paired with `accent`
   *  to give the tile a single-color identity without the previous
   *  full tinted card surface. */
  dot: string
  /** Legacy `tone` prop kept for source compat with old callers
   *  (parent passes both); ignored — the flat treatment doesn't
   *  use a tinted background anymore. */
  tone?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/70 bg-card p-3">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-medium leading-none tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  )
}
