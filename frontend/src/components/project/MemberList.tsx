'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectMember, ProjectRole } from '@/types/user'
import { addProjectMember, removeProjectMember } from '@/lib/api/projectApi'
import { projectKeys } from '@/lib/hooks/useProjects'
import { useUsers } from '@/lib/hooks/useUsers'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/AvatarUpload'

interface MemberListProps {
  projectId: string
  members: ProjectMember[]
  canManageMembers: boolean
  callerProjectRole?: string
  callerSystemRole?: string
}

export function MemberList({ projectId, members, canManageMembers, callerProjectRole, callerSystemRole }: MemberListProps) {
  const queryClient = useQueryClient()
  const { data: allUsers } = useUsers()
  const [showAddModal, setShowAddModal] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('MEMBER')
  const [addError, setAddError] = useState('')

  const hasTeamLead = members.some((m) => m.projectRole === 'TEAM_LEAD')

  const memberUserIds = new Set(members.map((m) => m.userId))
  const availableUsers = (allUsers ?? []).filter(
    (u) => !memberUserIds.has(u.userId) && u.systemRole !== 'OWNER'
  )

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; projectRole: ProjectRole }) =>
      addProjectMember(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      setShowAddModal(false)
      setSelectedUserId('')
      setSelectedRole('MEMBER')
      setAddError('')
    },
    onError: (err: Error) => {
      setAddError(err.message || 'Failed to add member')
    },
  })

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return
    setRemovingId(userId)
    try {
      await removeProjectMember(projectId, userId)
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
    } finally {
      setRemovingId(null)
    }
  }

  const handleAdd = async () => {
    if (!selectedUserId) {
      setAddError('Please select a user')
      return
    }
    setAddError('')
    await addMemberMutation.mutateAsync({ userId: selectedUserId, projectRole: selectedRole })
  }

  const roleBadgeColor: Record<ProjectRole, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    TEAM_LEAD: 'bg-orange-100 text-orange-700',
    MEMBER: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="flex flex-col gap-4">
      {canManageMembers && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddModal(true)}>+ Add Member</Button>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No members yet. Add members to get started.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  User
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Joined
                </th>
                {canManageMembers && (
                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((member) => (
                <tr key={member.userId} className="hover:bg-gray-50/60 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar url={member.user?.avatarUrl} name={member.user?.name || member.user?.email || member.userId} size="md" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.name ?? member.userId}
                        </div>
                        {member.user?.email && (
                          <div className="text-xs text-gray-500">{member.user.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeColor[member.projectRole]}`}
                    >
                      {member.projectRole}
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
        onClose={() => { setShowAddModal(false); setAddError(''); setSelectedUserId(''); }}
        title="Add Member to Project"
      >
        <div className="flex flex-col gap-4">
          {addError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {addError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
            {availableUsers.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No available users to add. Create users first from the Users page.</p>
            ) : (
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- Select a user --</option>
                {availableUsers.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name || u.email} ({u.email}) - {u.systemRole}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Role</label>
            {(() => {
              const isSystemOwner = callerSystemRole === 'OWNER' || callerSystemRole === 'CEO' || callerSystemRole === 'MD'
              const canAssignLeadAndAdmin = isSystemOwner || callerProjectRole === 'ADMIN'
              const showTeamLead = canAssignLeadAndAdmin && !hasTeamLead
              const showAdmin = canAssignLeadAndAdmin

              // If only "Member" is available, show it as a static label
              if (!showTeamLead && !showAdmin) {
                return (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">Member</p>
                )
              }

              return (
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
                >
                  <option value="MEMBER">Member</option>
                  {showTeamLead && <option value="TEAM_LEAD">Team Lead</option>}
                  {showAdmin && <option value="ADMIN">Admin</option>}
                </select>
              )
            })()}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowAddModal(false); setAddError(''); setSelectedUserId(''); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAdd}
              disabled={addMemberMutation.isPending || !selectedUserId}
            >
              {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
