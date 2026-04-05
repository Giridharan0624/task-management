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
  useCancelDayOff,
} from '@/lib/hooks/useDayOffs'
import type { DayOffRequest, DayOffStatus, ApprovalStatus } from '@/types/dayoff'
import { useUsers } from '@/lib/hooks/useUsers'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DatePicker } from '@/components/ui/DatePicker'
import { TimePicker } from '@/components/ui/TimePicker'

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: DayOffStatus | ApprovalStatus }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    REJECTED: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    CANCELLED: 'bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200',
    'N/A': 'bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg ${styles[status] ?? styles['N/A']}`}>
      {status}
    </span>
  )
}

/* ─── Day-Off Score ─── */
function getDayOffScore(userId: string, dayOffs: DayOffRequest[]) {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
  let daysOff = 0
  for (const d of dayOffs) {
    if (d.userId !== userId || d.status !== 'APPROVED') continue
    const start = d.startDate.slice(0, 10)
    const end = d.endDate.slice(0, 10)
    if (start > monthEnd || end < monthStart) continue
    const from = new Date(Math.max(new Date(start).getTime(), new Date(monthStart).getTime()))
    const to = new Date(Math.min(new Date(end).getTime(), new Date(monthEnd).getTime()))
    daysOff += Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  const score = daysOff === 0 ? 100 : daysOff <= 2 ? 75 : daysOff <= 5 ? 50 : 25
  return { score, daysOff }
}

function DayOffScoreCard({ userId, dayOffs }: { userId: string; dayOffs: DayOffRequest[] }) {
  const { score, daysOff } = getDayOffScore(userId, dayOffs)
  const scoreColor = score === 100 ? 'text-emerald-600' : score >= 75 ? 'text-blue-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = score === 100 ? 'bg-emerald-50 border-emerald-200' : score >= 75 ? 'bg-blue-50 border-blue-200' : score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const scoreLabel = score === 100 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Average' : 'Low'
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })

  return (
    <div className={`rounded-2xl border p-3.5 ${scoreBg}`}>
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
}

function DayOffScoreBadge({ userId, dayOffs }: { userId: string; dayOffs: DayOffRequest[] }) {
  const { score } = getDayOffScore(userId, dayOffs)
  const color = score === 100 ? 'bg-emerald-100 text-emerald-700' : score >= 75 ? 'bg-blue-100 text-blue-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold tabular-nums ${color}`}>
      {score}
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
  showCancel,
  onApprove,
  onReject,
  onCancel,
  isActing,
}: {
  req: DayOffRequest
  showActions: boolean
  showCancel?: boolean
  onApprove: () => void
  onReject: () => void
  onCancel?: () => void
  isActing: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 hover-lift">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">
            {req.userName}
            {req.employeeId && <span className="ml-2 text-[10px] font-mono font-semibold text-gray-400">({req.employeeId})</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {req.startDate.slice(0, 10) === req.endDate.slice(0, 10)
              ? fmtDate(req.startDate)
              : <>{fmtDate(req.startDate)} &ndash; {fmtDate(req.endDate)}</>}
          </p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      {/* Reason */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        <span className="font-semibold text-gray-700">Reason:</span> {req.reason}
      </p>

      {/* Approval */}
      <div className="text-xs text-gray-500 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Decision:</span>
          <span className="font-semibold text-gray-700">
            {req.adminStatus === 'APPROVED' || req.adminStatus === 'REJECTED'
              ? req.adminName
              : req.adminStatus === 'CANCELLED' ? 'Cancelled by member'
              : 'Awaiting Admin'}
          </span>
          <StatusBadge status={req.adminStatus} />
        </div>
      </div>

      {/* Admin Actions */}
      {showActions && req.status === 'PENDING' && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Button size="sm" onClick={onApprove} disabled={isActing}>Approve</Button>
          <Button size="sm" variant="danger" onClick={onReject} disabled={isActing}>Reject</Button>
        </div>
      )}

      {/* Member Cancel */}
      {showCancel && req.status !== 'CANCELLED' && req.status !== 'REJECTED' && onCancel && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button onClick={onCancel}
            disabled={isActing}
            className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50">
            Cancel Request
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

  const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none transition-all hover:border-gray-300"

  return (
    <Modal isOpen onClose={onClose} title="Request Day Off" size="lg">
      <p className="text-xs text-gray-400 mb-5">Your request will be sent to an admin for approval</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Duration type toggle */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Duration</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all ${
                mode === 'single'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Single Day
            </button>
            <button
              type="button"
              onClick={() => setMode('multiple')}
              className={`px-4 py-2.5 text-sm font-semibold rounded-xl border-2 transition-all ${
                mode === 'multiple'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <DatePicker value={singleDate} onChange={setSingleDate} min={(() => {
                const now = new Date()
                const istHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours()
                // Before 5 PM IST → can request for today; After 5 PM → tomorrow onwards
                if (istHour < 17) return now.toISOString().slice(0, 10)
                const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
              })()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Time Range <span className="text-gray-400">(optional — leave blank for full day)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <TimePicker value={startTime} onChange={setStartTime} placeholder="From" />
                <TimePicker value={endTime} onChange={setEndTime} placeholder="To" />
              </div>
            </div>
          </div>
        )}

        {/* Multiple days mode */}
        {mode === 'multiple' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} min={(() => {
                const now = new Date()
                const istHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours()
                if (istHour < 17) return now.toISOString().slice(0, 10)
                const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
              })()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <DatePicker value={endDate} onChange={setEndDate} min={startDate || (() => {
                const now = new Date()
                const istHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours()
                if (istHour < 17) return now.toISOString().slice(0, 10)
                const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
              })()} />
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            placeholder="Why do you need time off?"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none resize-none transition-all hover:border-gray-300"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isPending}>Submit Request</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ─── Main Page ─── */
export default function DayOffsPage() {
  const { user } = useAuth()
  const role = user?.systemRole
  const isTopTier = role === 'OWNER'
  const isOwner = role === 'OWNER'
  const isAdminOrOwner = isTopTier || role === 'ADMIN'

  const { data: myDayOffs, isLoading: myLoading } = useMyDayOffs()
  const { data: pendingDayOffs, isLoading: pendingLoading } = usePendingDayOffs()
  const { data: allDayOffs, isLoading: allLoading } = useAllDayOffs()
  const { data: allUsers } = useUsers()

  const createMutation = useCreateDayOff()
  const approveMutation = useApproveDayOff()
  const rejectMutation = useRejectDayOff()
  const cancelMutation = useCancelDayOff()
  const confirmDialog = useConfirm()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [allFilter, setAllFilter] = useState<'ALL' | DayOffStatus>('ALL')

  const filteredAll = useMemo(() => {
    if (!allDayOffs) return []
    if (allFilter === 'ALL') return allDayOffs
    return allDayOffs.filter((r: DayOffRequest) => r.status === allFilter)
  }, [allDayOffs, allFilter])

  const isActing = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Day Off Requests</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isOwner ? 'Review and manage employee time-off requests' : 'Manage your time-off requests'}
          </p>
        </div>
        {!isOwner && (
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Request Day Off
          </Button>
        )}
      </div>

      {/* ── Team Day-Off Scores (OWNER) ── */}
      {isOwner && allDayOffs && allUsers && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Team Day-Off Scores · {new Date().toLocaleDateString('en-US', { month: 'long' })}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {allUsers.filter(u => u.systemRole !== 'OWNER').map(u => {
              const { score, daysOff } = getDayOffScore(u.userId, allDayOffs)
              const color = score === 100 ? 'text-emerald-600' : score >= 75 ? 'text-blue-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
              const bg = score === 100 ? 'border-emerald-100' : score >= 75 ? 'border-blue-100' : score >= 50 ? 'border-amber-100' : 'border-red-100'
              return (
                <div key={u.userId} className={`bg-white rounded-xl border ${bg} p-3 shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{u.name || u.email}</p>
                    <span className={`text-lg font-bold tabular-nums ${color}`}>{score}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{u.systemRole}</span>
                    <span className="text-[10px] text-gray-400">{daysOff}d off</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── My Day-Off Score (ADMIN/MEMBER) ── */}
      {user && !isOwner && allDayOffs && (
        <DayOffScoreCard userId={user.userId} dayOffs={allDayOffs} />
      )}

      {/* ── Section 1: My Requests (not for OWNER) ── */}
      {!isOwner && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">My Requests</h2>
          {myLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !myDayOffs?.length ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">You have no day-off requests yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-fade">
              {myDayOffs.map((req: DayOffRequest) => (
                <RequestCard key={req.requestId} req={req} showActions={false} showCancel={true}
                  onApprove={() => {}} onReject={() => {}} onCancel={async () => {
                    if (await confirmDialog({ title: 'Cancel Day Off', description: 'Are you sure you want to cancel this day-off request?', confirmLabel: 'Cancel Request' })) cancelMutation.mutate(req.requestId)
                  }}
                  isActing={cancelMutation.isPending} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Section 2: Pending Approvals (OWNER / ADMIN) ── */}
      {(role === 'OWNER' || role === 'ADMIN') && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            Pending Approvals
            {(pendingDayOffs?.length ?? 0) > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-[10px] font-bold text-white">
                {pendingDayOffs?.length}
              </span>
            )}
          </h2>
          {pendingLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !pendingDayOffs?.length ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No pending requests require your approval.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-fade">
              {pendingDayOffs.map((req: DayOffRequest) => (
                <RequestCard
                  key={req.requestId}
                  req={req}
                  showActions={req.userId !== user?.userId}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">All Requests</h2>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAllFilter(f)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                    allFilter === f
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
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
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No requests found.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Employee</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Dates</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reason</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Approved By</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Score</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredAll.map((req: DayOffRequest) => (
                      <tr key={req.requestId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-900">{req.userName}</p>
                          {req.employeeId && <p className="text-[10px] font-mono text-gray-400">{req.employeeId}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                          {req.startDate.slice(0, 10) === req.endDate.slice(0, 10)
                            ? fmtDate(req.startDate)
                            : `${fmtDate(req.startDate)} – ${fmtDate(req.endDate)}`}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 max-w-[200px] truncate">{req.reason}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-gray-700">
                            {req.adminStatus === 'APPROVED' || req.adminStatus === 'REJECTED' ? req.adminName : 'Awaiting Admin'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <DayOffScoreBadge userId={req.userId} dayOffs={allDayOffs ?? []} />
                        </td>
                        <td className="px-5 py-3.5">
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

      {/* ── Modal ── */}
      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          isPending={createMutation.isPending}
          onCreate={(data) => {
            createMutation.mutate(data, { onSuccess: () => setShowCreateModal(false) })
          }}
        />
      )}
    </div>
  )
}
