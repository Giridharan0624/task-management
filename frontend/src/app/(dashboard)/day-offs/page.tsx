'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  useMyDayOffs,
  usePendingDayOffs,
  useAllDayOffs,
  useCreateDayOff,
  useApproveDayOff,
  useRejectDayOff,
} from '@/lib/hooks/useDayOffs'
import type { DayOffRequest, DayOffStatus, ApprovalStatus } from '@/types/dayoff'
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
  onApprove,
  onReject,
  isActing,
}: {
  req: DayOffRequest
  showActions: boolean
  onApprove: () => void
  onReject: () => void
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
            {req.startDate.slice(0, 10) === req.endDate.slice(0, 10)
              ? fmtDate(req.startDate)
              : <>{fmtDate(req.startDate)} &ndash; {fmtDate(req.endDate)}</>}
          </p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* Reason */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        <span className="font-medium text-gray-700">Reason:</span> {req.reason}
      </p>

      {/* Approval */}
      <div className="text-xs text-gray-500 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Decision:</span>
          <span className="font-medium text-gray-700">
            {req.adminStatus === 'APPROVED' || req.adminStatus === 'REJECTED'
              ? req.adminName
              : 'Awaiting CEO/MD'}
          </span>
          <StatusBadge status={req.adminStatus} />
        </div>
      </div>

      {/* Actions — only CEO/MD */}
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
        </div>
      )}
    </div>
  )
}

/* ─── Create Request Modal ─── */
function CreateModal({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void
  onCreate: (data: { startDate: string; endDate: string; reason: string }) => void
  isPending: boolean
}) {
  const [mode, setMode] = useState<'single' | 'multiple'>('single')
  const [singleDate, setSingleDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return

    if (mode === 'single') {
      if (!singleDate) return
      const start = startTime ? `${singleDate}T${startTime}` : singleDate
      const end = endTime ? `${singleDate}T${endTime}` : singleDate
      onCreate({ startDate: start, endDate: end, reason: reason.trim() })
    } else {
      if (!startDate || !endDate) return
      onCreate({ startDate, endDate, reason: reason.trim() })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Request Day Off</h3>
        <p className="text-xs text-gray-500 mb-5">Your request will be sent to the CEO/MD for approval</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duration type toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Duration</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                  mode === 'single'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => setMode('multiple')}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                  mode === 'multiple'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Multiple Days
              </button>
            </div>
          </div>

          {/* Single day mode */}
          {mode === 'single' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Range <span className="text-gray-400 font-normal">(optional — leave blank for full day)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">From</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 pl-12 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">To</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 pl-12 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multiple days mode */}
          {mode === 'multiple' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
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
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Why do you need time off?"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
/* ─── Main Page ─── */
export default function DayOffsPage() {
  const { user } = useAuth()
  const role = user?.systemRole
  const isTopTier = role === 'OWNER' || role === 'CEO' || role === 'MD'
  const isOwner = isTopTier
  const isAdminOrOwner = isTopTier || role === 'ADMIN'
  const isApprover = isAdminOrOwner || role === 'TEAM_LEAD'

  const { data: myDayOffs, isLoading: myLoading } = useMyDayOffs()
  const { data: pendingDayOffs, isLoading: pendingLoading } = usePendingDayOffs()
  const { data: allDayOffs, isLoading: allLoading } = useAllDayOffs()

  const createMutation = useCreateDayOff()
  const approveMutation = useApproveDayOff()
  const rejectMutation = useRejectDayOff()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [allFilter, setAllFilter] = useState<'ALL' | DayOffStatus>('ALL')


  const filteredAll = useMemo(() => {
    if (!allDayOffs) return []
    if (allFilter === 'ALL') return allDayOffs
    return allDayOffs.filter((r: DayOffRequest) => r.status === allFilter)
  }, [allDayOffs, allFilter])

  const isActing = approveMutation.isPending || rejectMutation.isPending

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
                onApprove={() => {}}
                onReject={() => {}}
                isActing={false}
              />
            ))}
          </div>
        )}
      </section>}

      {/* ── Section 2: Pending Approvals (CEO / MD only) ── */}
      {(role === 'CEO' || role === 'MD') && (
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
                  onApprove={() => approveMutation.mutate(req.requestId)}
                  onReject={() => rejectMutation.mutate(req.requestId)}
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
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Approved By</th>
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
                          {req.startDate.slice(0, 10) === req.endDate.slice(0, 10)
                            ? fmtDate(req.startDate)
                            : `${fmtDate(req.startDate)} – ${fmtDate(req.endDate)}`}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{req.reason}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-700">
                            {req.adminStatus === 'APPROVED' || req.adminStatus === 'REJECTED'
                              ? req.adminName
                              : 'Awaiting CEO/MD'}
                          </span>
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
          onClose={() => setShowCreateModal(false)}
          isPending={createMutation.isPending}
          onCreate={(data) => {
            createMutation.mutate(data, {
              onSuccess: () => setShowCreateModal(false),
            })
          }}
        />
      )}

    </div>
  )
}
