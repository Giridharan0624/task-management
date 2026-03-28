'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useAdmins } from '@/lib/hooks/useUsers'
import {
  useMyDayOffs,
  usePendingDayOffs,
  useAllDayOffs,
  useCreateDayOff,
  useApproveDayOff,
  useRejectDayOff,
  useForwardDayOff,
} from '@/lib/hooks/useDayOffs'
import type { DayOffRequest, DayOffStatus, ApprovalStatus } from '@/types/dayoff'
import type { AdminInfo } from '@/lib/api/userApi'
import { Spinner } from '@/components/ui/Spinner'

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: DayOffStatus | ApprovalStatus }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    'N/A': 'bg-gray-50 text-gray-500 border-gray-200',
  }
  const icons: Record<string, string> = {
    PENDING: '\u23f3',
    APPROVED: '\u2713',
    REJECTED: '\u2717',
    'N/A': '\u2014',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${styles[status] ?? styles['N/A']}`}>
      {icons[status]} {status}
    </span>
  )
}

/* ─── Format date helper ─── */
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

/* ─── Request Card ─── */
function RequestCard({
  req,
  showActions,
  isAdmin,
  onApprove,
  onReject,
  onForward,
  isActing,
}: {
  req: DayOffRequest
  showActions: boolean
  isAdmin: boolean
  onApprove: () => void
  onReject: () => void
  onForward: () => void
  isActing: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {req.userName}
            {req.employeeId && <span className="ml-2 text-xs font-medium text-gray-500">({req.employeeId})</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDate(req.startDate)} &ndash; {fmtDate(req.endDate)}
          </p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* Reason */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        <span className="font-medium text-gray-700">Reason:</span> {req.reason}
      </p>

      {/* Approval chain */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mb-4">
        <span>
          Team Lead: {req.teamLeadName ?? 'N/A'}{' '}
          <StatusBadge status={req.teamLeadStatus} />
        </span>
        <span>
          Admin: {req.adminName ?? 'N/A'}{' '}
          <StatusBadge status={req.adminStatus} />
        </span>
        {req.forwardedToName && (
          <span>
            Forwarded to: {req.forwardedToName}
          </span>
        )}
      </div>

      {/* Actions */}
      {showActions && req.status === 'PENDING' && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={onApprove}
            disabled={isActing}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={isActing}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          {isAdmin && (
            <button
              onClick={onForward}
              disabled={isActing}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors ml-auto"
            >
              Forward
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Create Request Modal ─── */
function CreateModal({
  admins,
  onClose,
  onCreate,
  isPending,
}: {
  admins: AdminInfo[]
  onClose: () => void
  onCreate: (data: { startDate: string; endDate: string; reason: string; adminId: string }) => void
  isPending: boolean
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [adminId, setAdminId] = useState(admins[0]?.userId ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate || !reason.trim() || !adminId) return
    onCreate({ startDate, endDate, reason: reason.trim(), adminId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Request Day Off</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin</label>
            <select
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="" disabled>Select an admin</option>
              {admins.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name} ({a.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Why do you need time off?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Forward Modal ─── */
function ForwardModal({
  admins,
  onClose,
  onForward,
  isPending,
}: {
  admins: AdminInfo[]
  onClose: () => void
  onForward: (adminId: string) => void
  isPending: boolean
}) {
  const [selected, setSelected] = useState(admins[0]?.userId ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Forward Request</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Forward to Admin</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            {admins.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name} ({a.email})
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onForward(selected)}
            disabled={isPending || !selected}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Forwarding...' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ─── */
export default function DayOffsPage() {
  const { user } = useAuth()
  const role = user?.systemRole
  const isTopTier = role === 'OWNER' || role === 'CEO' || role === 'MD'
  const isOwner = isTopTier
  const isAdminOrOwner = isTopTier || role === 'ADMIN'
  const isApprover = isAdminOrOwner || role === 'TEAM_LEAD'

  const { data: admins } = useAdmins()
  const { data: myDayOffs, isLoading: myLoading } = useMyDayOffs()
  const { data: pendingDayOffs, isLoading: pendingLoading } = usePendingDayOffs()
  const { data: allDayOffs, isLoading: allLoading } = useAllDayOffs()

  const createMutation = useCreateDayOff()
  const approveMutation = useApproveDayOff()
  const rejectMutation = useRejectDayOff()
  const forwardMutation = useForwardDayOff()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [forwardingRequestId, setForwardingRequestId] = useState<string | null>(null)
  const [allFilter, setAllFilter] = useState<'ALL' | DayOffStatus>('ALL')

  const adminList = admins ?? []

  const filteredAll = useMemo(() => {
    if (!allDayOffs) return []
    if (allFilter === 'ALL') return allDayOffs
    return allDayOffs.filter((r: DayOffRequest) => r.status === allFilter)
  }, [allDayOffs, allFilter])

  const isActing = approveMutation.isPending || rejectMutation.isPending || forwardMutation.isPending

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Day Off Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isOwner ? 'Review and manage employee time-off requests' : 'Manage your time-off requests'}
          </p>
        </div>
        {!isOwner && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Request Day Off
          </button>
        )}
      </div>

      {/* ── Section 1: My Requests (not for OWNER) ── */}
      {!isOwner && <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Requests</h2>
        {myLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !myDayOffs?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">You have no day-off requests yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myDayOffs.map((req: DayOffRequest) => (
              <RequestCard
                key={req.requestId}
                req={req}
                showActions={false}
                isAdmin={false}
                onApprove={() => {}}
                onReject={() => {}}
                onForward={() => {}}
                isActing={false}
              />
            ))}
          </div>
        )}
      </section>}

      {/* ── Section 2: Pending Approvals (ADMIN / TEAM_LEAD / OWNER) ── */}
      {isApprover && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Approvals</h2>
          {pendingLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !pendingDayOffs?.length ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No pending requests require your approval.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingDayOffs.map((req: DayOffRequest) => (
                <RequestCard
                  key={req.requestId}
                  req={req}
                  showActions={true}
                  isAdmin={isAdminOrOwner}
                  onApprove={() => approveMutation.mutate(req.requestId)}
                  onReject={() => rejectMutation.mutate(req.requestId)}
                  onForward={() => setForwardingRequestId(req.requestId)}
                  isActing={isActing}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Section 3: All Requests (OWNER / ADMIN) ── */}
      {isAdminOrOwner && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">All Requests</h2>
            <div className="flex items-center gap-2">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAllFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    allFilter === f
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {allLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !filteredAll.length ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">No requests found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Employee</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Dates</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Reason</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Team Lead</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Admin</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAll.map((req: DayOffRequest) => (
                      <tr key={req.requestId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{req.userName}</p>
                          {req.employeeId && (
                            <p className="text-xs text-gray-500">{req.employeeId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {fmtDate(req.startDate)} &ndash; {fmtDate(req.endDate)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{req.reason}</td>
                        <td className="px-4 py-3">
                          <span className="text-gray-600">{req.teamLeadName ?? 'N/A'}</span>
                          <span className="ml-1"><StatusBadge status={req.teamLeadStatus} /></span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-600">{req.adminName ?? 'N/A'}</span>
                          <span className="ml-1"><StatusBadge status={req.adminStatus} /></span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={req.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Modals ── */}
      {showCreateModal && (
        <CreateModal
          admins={adminList}
          onClose={() => setShowCreateModal(false)}
          isPending={createMutation.isPending}
          onCreate={(data) => {
            createMutation.mutate(data, {
              onSuccess: () => setShowCreateModal(false),
            })
          }}
        />
      )}

      {forwardingRequestId && (
        <ForwardModal
          admins={adminList}
          onClose={() => setForwardingRequestId(null)}
          isPending={forwardMutation.isPending}
          onForward={(adminId) => {
            forwardMutation.mutate(
              { requestId: forwardingRequestId, forwardToId: adminId },
              { onSuccess: () => setForwardingRequestId(null) }
            )
          }}
        />
      )}
    </div>
  )
}
