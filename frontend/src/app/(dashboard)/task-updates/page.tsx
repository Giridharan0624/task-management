'use client'

import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useHasPermission } from '@/lib/hooks/usePermission'
import { useTaskUpdates } from '@/lib/hooks/useTaskUpdates'
import { useUsers } from '@/lib/hooks/useUsers'
import {
  useAttendanceReport,
  useTodayAttendance,
} from '@/lib/hooks/useAttendance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  TaskUpdateToolbar,
  type TaskUpdateTab,
} from '@/components/taskupdate/TaskUpdateToolbar'
import { TaskUpdateStatStrip } from '@/components/taskupdate/TaskUpdateStatStrip'
import { SubmittedUpdateCard } from '@/components/taskupdate/SubmittedUpdateCard'
import {
  MissingSubmittersList,
  type MissingSubmitter,
} from '@/components/taskupdate/MissingSubmittersList'
import { getSessionHours } from '@/lib/utils/liveSession'
import { buildCsvName } from '@/lib/utils/csvFilename'
import type { Attendance } from '@/types/attendance'

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseTime(t: string): number {
  const h = t.match(/(\d+)h/)
  const m = t.match(/(\d+)m/)
  const s = t.match(/(\d+)s/)
  return (
    (h ? parseInt(h[1]) : 0) +
    (m ? parseInt(m[1]) / 60 : 0) +
    (s ? parseInt(s[1]) / 3600 : 0)
  )
}

function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0 && mins === 0) return '0m'
  return hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`
}

export default function TaskUpdatesPage() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TaskUpdateTab>('submitted')

  const today = getToday()
  const isToday = selectedDate === today

  const { data: updates, isLoading: updatesLoading } =
    useTaskUpdates(selectedDate)
  const { data: allUsers } = useUsers()
  // Attendance for a past date uses the report endpoint; today uses its dedicated hook.
  const { data: todayAttendance } = useTodayAttendance()
  const { data: reportAttendance } = useAttendanceReport(
    isToday ? '' : selectedDate,
    isToday ? '' : selectedDate
  )

  const attendanceForDay: Attendance[] = isToday
    ? (todayAttendance ?? [])
    : (reportAttendance ?? [])

  // Gate the team-wide submissions view on the live permission.
  // Falls back to the role check during the roles-fetch window.
  const canViewPerm = useHasPermission('taskupdate.list.all')
  const legacyCanView =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const canView = canViewPerm === null ? legacyCanView : canViewPerm

  // Lookups
  const userByIdRaw = useMemo(() => {
    const m = new Map<string, { email: string; avatarUrl?: string }>()
    for (const u of allUsers ?? []) {
      m.set(u.userId, { email: u.email, avatarUrl: u.avatarUrl })
    }
    return m
  }, [allUsers])

  // People who worked that day (at least one session)
  const workers = useMemo(() => {
    return attendanceForDay.filter(
      (a) => (a.sessions ?? []).length > 0
    )
  }, [attendanceForDay])

  // People who submitted
  const submittedIds = useMemo(
    () => new Set((updates ?? []).map((u) => u.userId)),
    [updates]
  )

  // Missing = workers whose userId isn't in submittedIds
  const missingSubmitters: MissingSubmitter[] = useMemo(() => {
    const items: MissingSubmitter[] = workers
      .filter((w) => !submittedIds.has(w.userId))
      .map((w) => {
        const hoursLogged = (w.sessions ?? []).reduce(
          (sum, s) => sum + getSessionHours(s),
          0
        )
        const lookup = userByIdRaw.get(w.userId)
        return {
          userId: w.userId,
          userName: w.userName,
          userEmail: lookup?.email ?? w.userEmail,
          employeeId: undefined, // attendance record doesn't carry employeeId; TaskUpdate does
          hoursLogged,
          sessionCount: (w.sessions ?? []).length,
          avatarUrl: lookup?.avatarUrl,
        }
      })
    return items
  }, [workers, submittedIds, userByIdRaw])

  // Filter by search (applies to both tabs)
  const q = search.trim().toLowerCase()

  const filteredSubmitted = useMemo(() => {
    const list = updates ?? []
    if (!q) return list
    return list.filter(
      (u) =>
        u.userName.toLowerCase().includes(q) ||
        (u.employeeId || '').toLowerCase().includes(q) ||
        (userByIdRaw.get(u.userId)?.email || '').toLowerCase().includes(q)
    )
  }, [updates, q, userByIdRaw])

  const filteredMissing = useMemo(() => {
    if (!q) return missingSubmitters
    return missingSubmitters.filter(
      (m) =>
        m.userName.toLowerCase().includes(q) ||
        m.userEmail.toLowerCase().includes(q) ||
        (m.employeeId || '').toLowerCase().includes(q)
    )
  }, [missingSubmitters, q])

  // Stats — always computed from unfiltered data so chips reflect reality
  const submittedCount = (updates ?? []).length
  const missingCount = missingSubmitters.length
  const teamWorkedCount = workers.length
  const totalHours = useMemo(
    () => (updates ?? []).reduce((s, u) => s + parseTime(u.totalTime), 0),
    [updates]
  )
  const avgHours = submittedCount > 0 ? totalHours / submittedCount : 0

  const exportCSV = () => {
    if (filteredSubmitted.length === 0) return
    const header = [
      'Name',
      'Employee ID',
      'Email',
      'Date',
      'Sign In',
      'Sign Out',
      'Total Time',
      'Tasks',
    ]
    const rows = filteredSubmitted.map((u) => [
      u.userName,
      u.employeeId || '',
      userByIdRaw.get(u.userId)?.email ?? '',
      u.date,
      u.signIn,
      u.signOut,
      u.totalTime,
      u.taskSummary
        .map((t) => `${t.taskName} (${t.timeRecorded})`)
        .join('; '),
    ])
    const csv = [header, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = buildCsvName('task-updates', selectedDate)
    a.click()
  }

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title="Daily Updates"
        description="Daily work summaries from team members"
      />

      <TaskUpdateToolbar
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        today={today}
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        submittedCount={submittedCount}
        missingCount={missingCount}
        onExportCSV={exportCSV}
        canExport={filteredSubmitted.length > 0}
      />

      <TaskUpdateStatStrip
        teamSize={teamWorkedCount}
        submitted={submittedCount}
        missing={missingCount}
        totalHoursLabel={formatHours(totalHours)}
        avgHoursLabel={formatHours(avgHours)}
      />

      {updatesLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : tab === 'submitted' ? (
        filteredSubmitted.length === 0 ? (
          <EmptyState
            icon={
              <FileText
                className="h-7 w-7 text-muted-foreground/70"
                strokeWidth={1.5}
              />
            }
            title={
              q
                ? 'No matching updates'
                : isToday
                  ? 'No updates submitted yet'
                  : 'No updates for this date'
            }
            description={
              q
                ? `Nothing matches "${search}"`
                : isToday
                  ? 'Daily updates will appear here as team members submit their summaries from the desktop app.'
                  : 'No one submitted a daily update on this date.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredSubmitted.map((u) => (
              <SubmittedUpdateCard
                key={u.updateId}
                update={u}
                avatarUrl={userByIdRaw.get(u.userId)?.avatarUrl}
              />
            ))}
          </div>
        )
      ) : (
        <MissingSubmittersList items={filteredMissing} isToday={isToday} />
      )}
    </div>
  )
}
