'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectMember, ProjectRole } from '@/types/user'
import type { Task } from '@/types/task'
import { addProjectMember, removeProjectMember, updateMemberRole } from '@/lib/api/projectApi'
import { projectKeys } from '@/lib/hooks/useProjects'
import { useUsers } from '@/lib/hooks/useUsers'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/AvatarUpload'
import { UserSelect } from '@/components/ui/UserSelect'
import { Select } from '@/components/ui/Select'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface MemberListProps {
  projectId: string
  members: ProjectMember[]
  tasks?: Task[]
  canManageMembers: boolean
  callerProjectRole?: string
  callerSystemRole?: string
}

const ROLE_LABEL: Record<ProjectRole, string> = {
  ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project Manager',
  TEAM_LEAD: 'Team Lead',
  MEMBER: 'Member',
}

const ROLE_BADGE: Record<ProjectRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  PROJECT_MANAGER: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  TEAM_LEAD: 'bg-orange-100 text-orange-700 border-orange-200',
  MEMBER: 'bg-blue-100 text-blue-700 border-blue-200',
}

export function MemberList({ projectId, members, tasks = [], canManageMembers, callerProjectRole, callerSystemRole }: MemberListProps) {
  const queryClient = useQueryClient()
  const { data: allUsers, isLoading: usersLoading, isError: usersError } = useUsers()
  const [showAddModal, setShowAddModal] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('MEMBER')
  const [addError, setAddError] = useState('')
  const [search, setSearch] = useState('')

  const hasTeamLead = members.some(m => m.projectRole === 'TEAM_LEAD')
  const isPrivileged = callerSystemRole === 'OWNER' || callerSystemRole === 'ADMIN'

  const memberUserIds = new Set(members.map(m => m.userId))
  const topTierRoles = new Set(['OWNER'])
  const availableUsers = (allUsers ?? []).filter(u => !memberUserIds.has(u.userId) && !topTierRoles.has(u.systemRole))

  // Task counts per member
  const taskCounts = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    for (const t of tasks) {
      for (const uid of t.assignedTo ?? []) {
        const ex = map.get(uid)
        if (ex) { ex.total += 1; if (t.status === 'DONE') ex.done += 1 }
        else map.set(uid, { total: 1, done: t.status === 'DONE' ? 1 : 0 })
      }
    }
    return map
  }, [tasks])

  // Role counts
  const roleCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of members) map[m.projectRole] = (map[m.projectRole] ?? 0) + 1
    return map
  }, [members])

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(m =>
      (m.user?.name || '').toLowerCase().includes(q) ||
      (m.user?.email || '').toLowerCase().includes(q)
    )
  }, [members, search])

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; projectRole: ProjectRole }) => addProjectMember(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      setShowAddModal(false); setSelectedUserId(''); setSelectedRole('MEMBER'); setAddError('')
    },
    onError: (err: Error) => setAddError(err.message || 'Failed to add member'),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) => updateMemberRole(projectId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  })

  const confirm = useConfirm()

  const handleRemove = async (userId: string) => {
    if (!await confirm({ title: 'Remove Member', description: 'This member will lose access to the project and its tasks.', confirmLabel: 'Remove' })) return
    setRemovingId(userId)
    try {
      await removeProjectMember(projectId, userId)
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
    } finally { setRemovingId(null) }
  }

  const handleAdd = async () => {
    if (!selectedUserId) { setAddError('Please select a user'); return }
    setAddError('')
    await addMemberMutation.mutateAsync({ userId: selectedUserId, projectRole: selectedRole })
  }

  const roleOptions = [
    { value: 'MEMBER', label: 'Member' },
    { value: 'PROJECT_MANAGER', label: 'Project Manager' },
    ...(!hasTeamLead ? [{ value: 'TEAM_LEAD', label: 'Team Lead' }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* Role stat badges + search + add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-gray-800">{members.length} Members</span>
          {Object.entries(roleCounts).map(([role, count]) => (
            <span key={role} className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold border ${ROLE_BADGE[role as ProjectRole] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {ROLE_LABEL[role as ProjectRole] || role}
              <span className="tabular-nums">{count}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-40 rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-[11px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white transition-all" />
          </div>
          {canManageMembers && (
            <button onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Add Member
            </button>
          )}
        </div>
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <p className="text-[14px] font-bold text-gray-800 mb-1">No members yet</p>
          <p className="text-[12px] text-gray-400 mb-4">Add team members to start collaborating</p>
          {canManageMembers && (
            <button onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-gray-800 transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add First Member
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_90px_90px_80px] gap-2 px-5 py-2.5 bg-gray-50/70 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <span>Member</span>
            <span>Role</span>
            <span className="text-center">Tasks</span>
            <span>Joined</span>
            {canManageMembers && <span className="text-right">Actions</span>}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filteredMembers.map(member => {
              const tc = taskCounts.get(member.userId)
              const totalTasks = tc?.total ?? 0
              const doneTasks = tc?.done ?? 0
              return (
                <div key={member.userId} className="grid grid-cols-[1fr_120px_90px_90px_80px] gap-2 items-center px-5 py-3 hover:bg-gray-50/50 transition-colors group">
                  {/* Member info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar url={member.user?.avatarUrl} name={member.user?.name || member.user?.email || member.userId} size="md" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">{member.user?.name ?? member.userId}</p>
                      {member.user?.email && <p className="text-[11px] text-gray-400 truncate">{member.user.email}</p>}
                    </div>
                  </div>

                  {/* Role — inline change or badge */}
                  <div>
                    {canManageMembers && isPrivileged ? (
                      <FilterSelect
                        value={member.projectRole}
                        onChange={v => changeRoleMutation.mutate({ userId: member.userId, role: v as ProjectRole })}
                        options={[
                          ...roleOptions,
                          ...(member.projectRole === 'TEAM_LEAD' && hasTeamLead ? [{ value: 'TEAM_LEAD', label: 'Team Lead' }] : []),
                        ]}
                        className="max-w-[110px]"
                      />
                    ) : (
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold border ${ROLE_BADGE[member.projectRole]}`}>
                        {ROLE_LABEL[member.projectRole] || member.projectRole}
                      </span>
                    )}
                  </div>

                  {/* Task count */}
                  <div className="text-center">
                    {totalTasks > 0 ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[12px] font-semibold text-gray-700 tabular-nums">{doneTasks}/{totalTasks}</span>
                        <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-300">—</span>
                    )}
                  </div>

                  {/* Joined */}
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>

                  {/* Actions */}
                  {canManageMembers && (
                    <div className="text-right">
                      <button onClick={() => handleRemove(member.userId)} disabled={removingId === member.userId}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {filteredMembers.length === 0 && members.length > 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-gray-400">No members match &ldquo;{search}&rdquo;</p>
                <button onClick={() => setSearch('')} className="text-[11px] text-indigo-600 font-semibold mt-1 hover:text-indigo-800">Clear search</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setAddError(''); setSelectedUserId('') }} title="Add Member to Project">
        <div className="flex flex-col gap-4">
          {addError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{addError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
            {usersLoading ? <p className="text-sm text-gray-500 italic">Loading users...</p>
              : usersError ? <p className="text-sm text-red-600 italic">Failed to load users.</p>
              : availableUsers.length === 0 ? <p className="text-sm text-gray-500 italic">All users are already members.</p>
              : (
                <UserSelect
                  users={availableUsers.map(u => ({ userId: u.userId, name: u.name || u.email, email: u.email, avatarUrl: u.avatarUrl, extra: u.systemRole }))}
                  value={selectedUserId} onChange={setSelectedUserId}
                />
              )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Role</label>
            {!isPrivileged ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">Member</p>
            ) : (
              <Select value={selectedRole} onChange={v => setSelectedRole(v as ProjectRole)} options={roleOptions} />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setAddError(''); setSelectedUserId('') }}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={addMemberMutation.isPending || !selectedUserId}>
              {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
