'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  X,
  Clock,
  FileDown,
  User,
  Users,
  ArrowDownUp,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useHasPermission } from '@/lib/hooks/usePermission'
import {
  useAttendanceReport,
  useMyAttendance,
} from '@/lib/hooks/useAttendance'
import { useUsers } from '@/lib/hooks/useUsers'
import { MyAttendanceView } from '@/components/attendance/MyAttendanceView'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  StatCardsGrid,
  type StatCardItem,
} from '@/components/ui/StatCardsGrid'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { AttendanceMonthNav } from '@/components/attendance/AttendanceMonthNav'
import {
  MemberAttendanceCard,
  type MemberAttendanceSummary,
} from '@/components/attendance/MemberAttendanceCard'
import { MemberAttendanceDrawer } from '@/components/attendance/MemberAttendanceDrawer'
import {
  WeeklyLeaderboard,
  type WeekLeaderboard,
  type WeeklyLeaderboardEntry,
} from '@/components/attendance/WeeklyLeaderboard'
import { formatDuration } from '@/lib/utils/formatDuration'
import { getSessionHours } from '@/lib/utils/liveSession'
import { buildCsvName } from '@/lib/utils/csvFilename'
import type { Attendance } from '@/types/attendance'

function getRecordHours(r: Attendance): number {
  return r.sessions.reduce((sum, s) => sum + getSessionHours(s), 0)
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end, daysInMonth: lastDay }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function generateCSV(records: Attendance[]): string {
  const rows: string[][] = [
    [
      'Name',
      'Email',
      'Role',
      'Date',
      'Session #',
      'Task',
      'Project',
      'Description',
      'Start',
      'End',
      'Duration',
    ],
  ]
  for (const r of records) {
    for (let i = 0; i < r.sessions.length; i++) {
      const s = r.sessions[i]
      rows.push([
        r.userName,
        r.userEmail,
        r.systemRole,
        r.date,
        String(i + 1),
        s.taskTitle || 'General',
        s.projectName || '-',
        s.description || '',
        formatTime(s.signInAt),
        s.signOutAt ? formatTime(s.signOutAt) : 'Active',
        formatDuration(getSessionHours(s)),
      ])
    }
  }
  return rows
    .map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')
}

type SortKey = 'hours' | 'name' | 'days' | 'sessions'

const SORT_LABELS: Record<SortKey, string> = {
  hours: 'Hours',
  name: 'Name',
  days: 'Days',
  sessions: 'Sessions',
}

export default function AttendancePage() {
  const { user } = useAuth()

  // Members get a self-focused view. The team-wide KPIs, leaderboard and
  // member-card grid in TeamAttendanceView are admin/owner surfaces —
  // members wouldn't see anyone but themselves anyway (backend scopes
  // the report endpoint per-caller when ATTENDANCE_REPORT_VIEW is absent).
  // Split into a separate component so its hooks only mount for admins.
  if (user?.systemRole === 'MEMBER') {
    return <MyAttendanceView />
  }
  return <TeamAttendanceView />
}

function TeamAttendanceView() {
  const { user } = useAuth()
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [memberFilter, setMemberFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('hours')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { start, end, daysInMonth } = getMonthRange(
    selectedYear,
    selectedMonth
  )
  const { data: rawRecords, isLoading } = useAttendanceReport(start, end)
  const { data: allUsers } = useUsers()
  const { data: myAttendance } = useMyAttendance()
  const hasActiveSession = myAttendance?.status === 'SIGNED_IN'

  // Live tick when any session in scope is open
  const [, setTick] = useState(0)
  useEffect(() => {
    const anyActive =
      hasActiveSession ||
      (rawRecords ?? []).some((r) => r.sessions.some((s) => !s.signOutAt))
    if (!anyActive) return
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [hasActiveSession, rawRecords])

  // Team attendance view is gated on the live user.progress.view
  // permission (same as reports — if you can see report data, you
  // can see the roster's hours). Falls back to the legacy role check
  // while roles are still loading.
  const canViewTeamProgress = useHasPermission('user.progress.view')
  const legacyPrivileged =
    user?.systemRole === 'OWNER' || user?.systemRole === 'ADMIN'
  const isPrivileged =
    canViewTeamProgress === null ? legacyPrivileged : canViewTeamProgress
  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleString(
    'en-US',
    { month: 'long', year: 'numeric' }
  )

  const userLookup = useMemo(() => {
    const m = new Map<string, { avatarUrl?: string }>()
    for (const u of allUsers ?? [])
      m.set(u.userId, { avatarUrl: u.avatarUrl })
    return m
  }, [allUsers])

  const scopedRecords = useMemo(() => {
    if (memberFilter === 'ALL') return rawRecords ?? []
    return (rawRecords ?? []).filter((r) => r.userId === memberFilter)
  }, [rawRecords, memberFilter])

  const memberOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rawRecords ?? [])
      map.set(r.userId, r.userName || r.userEmail)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rawRecords])

  const totalHours = useMemo(
    () => scopedRecords.reduce((s, r) => s + getRecordHours(r), 0),
    [scopedRecords]
  )
  const totalSessions = useMemo(
    () => scopedRecords.reduce((s, r) => s + r.sessions.length, 0),
    [scopedRecords]
  )
  const uniqueMembers = useMemo(
    () => new Set(scopedRecords.map((r) => r.userId)).size,
    [scopedRecords]
  )
  const uniqueDays = useMemo(
    () => new Set(scopedRecords.map((r) => r.date)).size,
    [scopedRecords]
  )
  const avgPerDay = uniqueDays > 0 ? totalHours / uniqueDays : 0

  /**
   * Per-member weekly leaderboard data — for each Mon–Sun week that
   * overlaps the selected month, compute each member's hours/days/sessions
   * so the leaderboard can rank them week by week.
   */
  const weeklyLeaderboard = useMemo((): WeekLeaderboard[] => {
    type WeekBucket = {
      weekStart: string
      weekEnd: string
      members: Map<
        string,
        { entry: WeeklyLeaderboardEntry; days: Set<string> }
      >
    }
    const weeks = new Map<string, WeekBucket>()

    for (const r of scopedRecords) {
      const d = new Date(r.date + 'T00:00:00')
      const dow = d.getDay()
      const mon = new Date(d)
      mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const weekKey = mon.toISOString().slice(0, 10)

      let bucket = weeks.get(weekKey)
      if (!bucket) {
        bucket = {
          weekStart: weekKey,
          weekEnd: sun.toISOString().slice(0, 10),
          members: new Map(),
        }
        weeks.set(weekKey, bucket)
      }

      let member = bucket.members.get(r.userId)
      if (!member) {
        member = {
          entry: {
            userId: r.userId,
            name: r.userName || r.userEmail,
            email: r.userEmail,
            avatarUrl: userLookup.get(r.userId)?.avatarUrl,
            role: r.systemRole,
            hours: 0,
            days: 0,
            sessions: 0,
            isActive: false,
          },
          days: new Set(),
        }
        bucket.members.set(r.userId, member)
      }
      member.days.add(r.date)
      member.entry.sessions += r.sessions.length
      member.entry.hours += getRecordHours(r)
      if (r.sessions.some((s) => !s.signOutAt)) member.entry.isActive = true
    }

    const result: WeekLeaderboard[] = []
    for (const bucket of weeks.values()) {
      const entries: WeeklyLeaderboardEntry[] = []
      for (const m of bucket.members.values()) {
        m.entry.days = m.days.size
        entries.push(m.entry)
      }
      result.push({
        weekStart: bucket.weekStart,
        weekEnd: bucket.weekEnd,
        entries,
      })
    }
    return result.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  }, [scopedRecords, userLookup])

  const memberSummaries = useMemo((): MemberAttendanceSummary[] => {
    const bucket = new Map<
      string,
      {
        summary: MemberAttendanceSummary
        records: Attendance[]
        taskHours: Map<
          string,
          { name: string; hours: number; project: string }
        >
      }
    >()

    for (const r of scopedRecords) {
      let entry = bucket.get(r.userId)
      if (!entry) {
        entry = {
          summary: {
            userId: r.userId,
            name: r.userName || r.userEmail,
            email: r.userEmail,
            role: r.systemRole,
            avatarUrl: userLookup.get(r.userId)?.avatarUrl,
            totalHours: 0,
            daysWorked: 0,
            sessionsCount: 0,
            avgPerDay: 0,
            dailyHours: new Array(daysInMonth).fill(0),
            isActive: false,
          },
          records: [],
          taskHours: new Map(),
        }
        bucket.set(r.userId, entry)
      }
      entry.records.push(r)
      entry.summary.daysWorked += 1
      entry.summary.sessionsCount += r.sessions.length

      const dayIdx = new Date(r.date + 'T00:00:00').getDate() - 1
      if (dayIdx >= 0 && dayIdx < daysInMonth) {
        const dayHours = r.sessions.reduce(
          (s, se) => s + getSessionHours(se),
          0
        )
        entry.summary.dailyHours[dayIdx] += dayHours
        entry.summary.totalHours += dayHours
      }

      for (const s of r.sessions) {
        if (!s.signOutAt) entry.summary.isActive = true
        const key = `${s.taskTitle || 'General'}::${s.projectName || '-'}`
        const hrs = getSessionHours(s)
        const existing = entry.taskHours.get(key)
        if (existing) {
          existing.hours += hrs
        } else {
          entry.taskHours.set(key, {
            name: s.taskTitle || 'General',
            project: s.projectName || '-',
            hours: hrs,
          })
        }
      }
    }

    const out: MemberAttendanceSummary[] = []
    for (const entry of bucket.values()) {
      entry.summary.avgPerDay =
        entry.summary.daysWorked > 0
          ? entry.summary.totalHours / entry.summary.daysWorked
          : 0
      const topTasks = Array.from(entry.taskHours.values()).sort(
        (a, b) => b.hours - a.hours
      )
      if (topTasks.length > 0) entry.summary.topTask = topTasks[0]
      out.push(entry.summary)
    }
    return out
  }, [scopedRecords, userLookup, daysInMonth])

  const visibleSummaries = useMemo(() => {
    let list = memberSummaries
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'days') return b.daysWorked - a.daysWorked
      if (sort === 'sessions') return b.sessionsCount - a.sessionsCount
      return b.totalHours - a.totalHours
    })
  }, [memberSummaries, search, sort])

  const canClear = !!search || memberFilter !== 'ALL' || sort !== 'hours'

  const selectedMember = useMemo(
    () =>
      selectedUserId
        ? memberSummaries.find((m) => m.userId === selectedUserId) ?? null
        : null,
    [selectedUserId, memberSummaries]
  )
  const selectedMemberRecords = useMemo(
    () =>
      selectedUserId
        ? scopedRecords.filter((r) => r.userId === selectedUserId)
        : [],
    [selectedUserId, scopedRecords]
  )

  const handleDownload = () => {
    if (!scopedRecords.length) return
    const csv = generateCSV(scopedRecords)
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = buildCsvName('attendance', start, end)
    a.click()
  }

  const statItems: StatCardItem[] = [
    {
      key: 'total-hours',
      label: 'Total hours',
      value: formatDuration(totalHours),
      accent: 'text-indigo-700',
    },
    {
      key: 'members',
      label: 'Members',
      value: uniqueMembers,
      accent: 'text-violet-700',
    },
    {
      key: 'sessions',
      label: 'Sessions',
      value: totalSessions,
      accent: 'text-blue-700',
    },
    {
      key: 'avg',
      label: 'Avg / day',
      value: formatDuration(avgPerDay),
      accent: 'text-emerald-700',
    },
  ]

  const memberFilterLabel =
    memberFilter === 'ALL'
      ? 'All members'
      : memberOptions.find((m) => m.id === memberFilter)?.name ?? 'Member'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title={isPrivileged ? 'Team Attendance' : 'My Attendance'}
        description={monthLabel}
        actions={
          <AttendanceMonthNav
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => {
              setSelectedYear(y)
              setSelectedMonth(m)
            }}
          />
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <StatCardsGrid items={statItems} columns={4} />

          {isPrivileged && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[220px] flex-1">
                <Input
                  type="text"
                  placeholder="Search member..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search />}
                  rightIcon={
                    search ? (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="pointer-events-auto rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : undefined
                  }
                  className="h-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                  >
                    {memberFilter === 'ALL' ? (
                      <Users className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                    <span className="max-w-[140px] truncate font-semibold">
                      {memberFilterLabel}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Filter by member</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={memberFilter}
                    onValueChange={setMemberFilter}
                  >
                    <DropdownMenuRadioItem value="ALL">
                      All members
                    </DropdownMenuRadioItem>
                    {memberOptions.map((m) => (
                      <DropdownMenuRadioItem key={m.id} value={m.id}>
                        {m.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    <span className="font-semibold">{SORT_LABELS[sort]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(v) => setSort(v as SortKey)}
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <DropdownMenuRadioItem key={k} value={k}>
                        {SORT_LABELS[k]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {canClear && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setMemberFilter('ALL')
                    setSort('hours')
                  }}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              )}

              <div className="ml-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!scopedRecords.length}
                  className="h-9 gap-1.5"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>
          )}

          <WeeklyLeaderboard
            weeks={weeklyLeaderboard}
            onMemberClick={(uid) => setSelectedUserId(uid)}
          />

          {visibleSummaries.length === 0 ? (
            <EmptyState
              icon={
                <Clock
                  className="h-7 w-7 text-muted-foreground/70"
                  strokeWidth={1.5}
                />
              }
              title={
                memberSummaries.length === 0
                  ? 'No attendance records'
                  : 'No members match your search'
              }
              description={
                memberSummaries.length === 0
                  ? `No one was clocked in during ${monthLabel}.`
                  : 'Try clearing your filters to see more members.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-rise">
              {visibleSummaries.map((member) => {
                const share =
                  totalHours > 0
                    ? Math.round((member.totalHours / totalHours) * 100)
                    : 0
                return (
                  <MemberAttendanceCard
                    key={member.userId}
                    member={member}
                    sharePercent={isPrivileged ? share : undefined}
                    onClick={() => setSelectedUserId(member.userId)}
                  />
                )
              })}
            </div>
          )}
        </>
      )}

      <MemberAttendanceDrawer
        open={!!selectedMember}
        onClose={() => setSelectedUserId(null)}
        member={selectedMember}
        records={selectedMemberRecords}
        monthLabel={monthLabel}
      />
    </div>
  )
}
