'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTaskUpdates } from '@/lib/hooks/useTaskUpdates'
import { useUsers } from '@/lib/hooks/useUsers'
import { Spinner } from '@/components/ui/Spinner'
import { DatePicker } from '@/components/ui/DatePicker'
import { Avatar } from '@/components/ui/AvatarUpload'
import type { TaskUpdate } from '@/types/taskupdate'

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function UpdateCard({ update, avatarUrl }: { update: TaskUpdate; avatarUrl?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 hover-lift transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar url={avatarUrl} name={update.userName} size="md" />
          <div>
            <p className="text-sm font-bold text-gray-900">{update.userName}</p>
            {update.employeeId && (
              <p className="text-[10px] font-mono text-gray-400">{update.employeeId}</p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(update.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Sign in / Sign out */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign In</p>
          <p className="text-sm font-semibold text-gray-900">{update.signIn}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sign Out</p>
          <p className="text-sm font-semibold text-gray-900">{update.signOut}</p>
        </div>
      </div>

      {/* Task Summary */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Task Summary</p>
        <div className="space-y-1.5">
          {update.taskSummary.map((t, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-700">{i + 1}. {t.taskName}</span>
              <span className="text-xs font-semibold text-indigo-600">{t.timeRecorded}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Time</span>
        <span className="text-lg font-bold text-gray-900">{update.totalTime}</span>
      </div>
    </div>
  )
}

export default function TaskUpdatesPage() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(getToday())
  const { data: updates, isLoading } = useTaskUpdates(selectedDate)
  const { data: allUsers } = useUsers()

  const avatarMap = new Map<string, string | undefined>()
  for (const u of allUsers ?? []) {
    if (u.avatarUrl) avatarMap.set(u.userId, u.avatarUrl)
  }

  const canView = user?.systemRole === 'OWNER' || user?.systemRole === 'CEO' || user?.systemRole === 'MD' || user?.systemRole === 'ADMIN'

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">You don&apos;t have permission to view this page.</p>
      </div>
    )
  }

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Task Updates</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-lg font-bold text-indigo-600">{dateLabel}</span>
            {selectedDate === getToday() && (
              <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 uppercase tracking-wider">Today</span>
            )}
            <span className="text-sm text-gray-400">&middot; {updates?.length ?? 0} updates</span>
          </div>
        </div>
        <DatePicker value={selectedDate} onChange={setSelectedDate} max={getToday()} className="w-48" />
      </div>

      {/* Updates */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !updates || updates.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">No task updates submitted for this date.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 stagger-fade">
          {updates.map((update) => (
            <UpdateCard key={update.updateId} update={update} avatarUrl={avatarMap.get(update.userId)} />
          ))}
        </div>
      )}
    </div>
  )
}
