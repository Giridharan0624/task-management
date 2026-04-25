'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, CalendarOff, FileDown, Search, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

export interface CalendarMember {
  userId: string
  name: string
  email: string
  avatarUrl?: string
  /** Length = daysInMonth. Index 0 → day 1. > 0 means present. */
  dailyHours: number[]
}

export interface CalendarDayOff {
  userId: string
  userName: string
  /** YYYY-MM-DD. */
  startDate: string
  /** YYYY-MM-DD inclusive. */
  endDate: string
  reason?: string
}

interface MonthAttendanceCalendarProps {
  year: number
  /** 1-based month (1 = Jan, 12 = Dec). */
  month: number
  members: CalendarMember[]
  /** Roster of EVERY workspace member — needed for the absent list. */
  roster?: { userId: string; name: string; email: string; avatarUrl?: string }[]
  /** Approved day-offs that overlap any day this month. The cell click
   *  modal slices these by date so the user sees who is on leave on the
   *  selected day, separate from "absent" (no record at all). */
  dayOffs?: CalendarDayOff[]
}

const WEEKDAY_HEADERS = [
  { label: 'Mon', isWeekend: false },
  { label: 'Tue', isWeekend: false },
  { label: 'Wed', isWeekend: false },
  { label: 'Thu', isWeekend: false },
  { label: 'Fri', isWeekend: false },
  { label: 'Sat', isWeekend: true },
  { label: 'Sun', isWeekend: true },
]

interface CellMeta {
  day: number | null
  isWeekend: boolean
}

/** Build a 6-week (42-cell) Monday-leading grid. */
function buildGrid(year: number, month: number): CellMeta[] {
  const firstOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // Convert Sun-leading 0..6 → Mon-leading 0..6.
  const dowSun0 = firstOfMonth.getDay()
  const leading = (dowSun0 + 6) % 7
  const cells: CellMeta[] = []
  for (let i = 0; i < leading; i++)
    cells.push({ day: null, isWeekend: WEEKDAY_HEADERS[i].isWeekend })
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d)
    const dowSun = dt.getDay()
    cells.push({ day: d, isWeekend: dowSun === 0 || dowSun === 6 })
  }
  while (cells.length < 42) {
    const colIdx = cells.length % 7
    cells.push({ day: null, isWeekend: WEEKDAY_HEADERS[colIdx].isWeekend })
  }
  return cells
}

export function MonthAttendanceCalendar({
  year,
  month,
  members,
  roster,
  dayOffs,
}: MonthAttendanceCalendarProps) {
  const grid = useMemo(() => buildGrid(year, month), [year, month])
  const daysInMonth = new Date(year, month, 0).getDate()

  // Per-day list of present members. O(1) cell reads after this.
  const presentByDay = useMemo(() => {
    const out: CalendarMember[][] = Array.from({ length: daysInMonth }, () => [])
    for (const m of members) {
      for (let i = 0; i < daysInMonth; i++) {
        if ((m.dailyHours[i] ?? 0) > 0) out[i].push(m)
      }
    }
    return out
  }, [members, daysInMonth])

  // Per-day set of userIds on approved leave. A day-off can span
  // multiple days; we expand the range and intersect with this month.
  const dayOffByDay = useMemo(() => {
    const out: Map<string, CalendarDayOff>[] = Array.from(
      { length: daysInMonth },
      () => new Map(),
    )
    if (!dayOffs?.length) return out
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month - 1, daysInMonth)
    for (const r of dayOffs) {
      const start = new Date(r.startDate + 'T00:00:00')
      const end = new Date(r.endDate + 'T00:00:00')
      if (end < monthStart || start > monthEnd) continue
      const from = start < monthStart ? monthStart : start
      const to = end > monthEnd ? monthEnd : end
      // Iterate inclusive day-by-day in local time.
      const cursor = new Date(from)
      while (cursor <= to) {
        const dayIdx = cursor.getDate() - 1
        out[dayIdx].set(r.userId, r)
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    return out
  }, [dayOffs, year, month, daysInMonth])

  const peak = useMemo(
    () => Math.max(1, ...presentByDay.map((d) => d.length)),
    [presentByDay],
  )

  const today = new Date()
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month

  // Selected day → opens the modal. Null = closed. No auto-open on mount
  // (the modal would steal attention every page load).
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const dayDetail = selectedDay
    ? buildDayDetail(year, month, selectedDay, presentByDay, dayOffByDay, roster)
    : null

  const rosterSize = roster?.length ?? 0

  // CSV export — calendar view only. Wide format: one row per member,
  // one column per day. Cell = P (present) / L (on leave) / A (absent).
  // First three columns carry the running totals so a reader scanning
  // top-down sees attendance shape before drilling into days.
  const exportCsv = () => {
    const monthLabel = `${year}-${String(month).padStart(2, '0')}`
    const headerCells = [
      'Member',
      'Email',
      'Days present',
      'Days on leave',
      'Days absent',
      ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    ]
    // Member directory: roster (when available) ∪ anyone we saw in the
    // attendance data. Falls back to the present-only list for tenants
    // that didn't pass a roster.
    const allMembers = new Map<
      string,
      { userId: string; name: string; email: string }
    >()
    if (roster) {
      for (const u of roster) {
        allMembers.set(u.userId, {
          userId: u.userId,
          name: u.name,
          email: u.email,
        })
      }
    }
    for (const m of members) {
      if (!allMembers.has(m.userId)) {
        allMembers.set(m.userId, {
          userId: m.userId,
          name: m.name,
          email: m.email,
        })
      }
    }
    // Index daily-hours and on-leave maps by userId for cheap lookups.
    const hoursById = new Map(members.map((m) => [m.userId, m.dailyHours]))
    const leaveById = new Map<string, Set<number>>()
    for (let i = 0; i < daysInMonth; i++) {
      const day = i + 1
      for (const uid of dayOffByDay[i]?.keys() ?? []) {
        if (!leaveById.has(uid)) leaveById.set(uid, new Set())
        leaveById.get(uid)!.add(day)
      }
    }

    const escape = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

    const rows: string[] = [headerCells.map(escape).join(',')]
    const sortedMembers = Array.from(allMembers.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    for (const m of sortedMembers) {
      const hours = hoursById.get(m.userId) ?? []
      const leaveDays = leaveById.get(m.userId) ?? new Set<number>()
      let present = 0
      let leave = 0
      let absent = 0
      const dayCells: string[] = []
      for (let i = 0; i < daysInMonth; i++) {
        const day = i + 1
        if ((hours[i] ?? 0) > 0) {
          present += 1
          dayCells.push('P')
        } else if (leaveDays.has(day)) {
          leave += 1
          dayCells.push('L')
        } else {
          absent += 1
          dayCells.push('A')
        }
      }
      rows.push(
        [
          m.name,
          m.email,
          String(present),
          String(leave),
          String(absent),
          ...dayCells,
        ]
          .map(escape)
          .join(','),
      )
    }

    const blob = new Blob([rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-calendar-${monthLabel}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* Header — single neutral row, no gradient tile */}
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[13px] font-semibold text-foreground">
          Daily attendance
        </h3>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          · click a day for details
        </span>
        <div className="ml-auto flex items-center gap-3">
          {rosterSize > 0 && (
            <div className="hidden items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground sm:flex">
              Peak{' '}
              <span className="font-semibold text-foreground">
                {peak} / {rosterSize}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={members.length === 0}
            title="Export this month's calendar view as CSV"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown className="h-3 w-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Weekday header — tight */}
      <div className="relative grid grid-cols-7 border-b border-border/60 bg-muted/20 px-1.5 py-1">
        {WEEKDAY_HEADERS.map((d) => (
          <div
            key={d.label}
            className={cn(
              'text-center text-[9px] font-bold uppercase tracking-[0.16em]',
              d.isWeekend ? 'text-muted-foreground/60' : 'text-muted-foreground',
            )}
          >
            {d.label}
          </div>
        ))}
      </div>

      {/* Day grid — restrained palette: every cell shares the card
          background; attendance reads as a thin bottom bar instead of
          a full-cell tint. Reads as a professional dashboard, not a
          coloured heatmap. */}
      <div className="relative grid grid-cols-7 gap-px bg-border/40 p-px">
        {grid.map((cell, i) => {
          if (cell.day === null) {
            return (
              <div
                key={i}
                className={cn(
                  'h-16 sm:h-[72px]',
                  cell.isWeekend ? 'bg-muted/30' : 'bg-card',
                )}
              />
            )
          }
          const present = presentByDay[cell.day - 1] ?? []
          const count = present.length
          const leaveCount = dayOffByDay[cell.day - 1]?.size ?? 0
          const ratio = Math.min(1, count / peak)
          const isToday = isCurrentMonth && today.getDate() === cell.day
          const isSelected = selectedDay === cell.day

          // Background: neutral always. Hover lifts the surface a touch
          // so the user knows the cell is interactive without colour.
          const cellBg = cell.isWeekend
            ? 'bg-muted/20 hover:bg-muted/40'
            : 'bg-card hover:bg-muted/30'

          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDay(cell.day)}
              aria-haspopup="dialog"
              aria-label={`${count} present, ${leaveCount} on leave on ${cell.day}`}
              className={cn(
                'group relative flex h-16 flex-col px-2 py-1.5 text-left transition-colors duration-150 sm:h-[72px]',
                cellBg,
                isSelected && 'ring-2 ring-inset ring-primary z-10',
                isToday && !isSelected && 'ring-1 ring-inset ring-primary/40',
              )}
            >
              {/* Day number — visually dominant (size + weight). The
                  presence count lives in a separate row below so the
                  two numbers are never read as a date range. */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      'text-[15px] font-bold leading-none tabular-nums',
                      isToday
                        ? 'text-primary'
                        : cell.isWeekend
                          ? 'text-muted-foreground/70'
                          : 'text-foreground',
                    )}
                  >
                    {cell.day}
                  </span>
                  {isToday && (
                    <span
                      aria-hidden
                      className="h-1 w-1 rounded-full bg-primary"
                    />
                  )}
                </div>
                {/* Leave glyph stays in the top-right — it's incidental
                    context, never the primary number for the cell. */}
                {leaveCount > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-amber-700 dark:text-amber-400"
                    title={`${leaveCount} on leave`}
                  >
                    <CalendarOff className="h-2.5 w-2.5" />
                    {leaveCount}
                  </span>
                )}
              </div>

              {/* Presence row — Users icon + count in muted style. The
                  icon answers "what is this number?" instantly so the
                  user never confuses it with the day number above. */}
              {count > 0 && (
                <div className="mt-1 flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                  <Users className="h-2.5 w-2.5" strokeWidth={2} />
                  <span className="font-semibold text-foreground/80">
                    {count}
                  </span>
                  <span className="text-muted-foreground/70">
                    / {peak}
                  </span>
                </div>
              )}

              {/* Attendance ratio bar — pinned to the bottom of the cell
                  so the day number, count row, and bar form a clear
                  three-tier visual hierarchy. */}
              {count > 0 && (
                <div className="mt-auto h-1 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all"
                    style={{ width: `${Math.max(8, ratio * 100)}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Day-detail modal — tabbed roster (Present / On leave / Absent)
          with search. Single visible list at a time keeps the dialog
          short and scannable instead of three stacked sections. */}
      <Modal
        isOpen={!!dayDetail}
        onClose={() => setSelectedDay(null)}
        title={dayDetail?.label ?? ''}
        size="lg"
      >
        {dayDetail && <DayDetailBody detail={dayDetail} />}
      </Modal>
    </Card>
  )
}

type RosterTab = 'present' | 'leave' | 'absent'

interface RosterMember {
  userId: string
  name: string
  avatarUrl?: string
  /** Optional small line under the name — used for the leave reason. */
  subtitle?: string
}

interface DayDetail {
  label: string
  present: RosterMember[]
  onLeave: RosterMember[]
  absent: RosterMember[] | null
}

function DayDetailBody({ detail }: { detail: DayDetail }) {
  const [tab, setTab] = useState<RosterTab>('present')
  const [query, setQuery] = useState('')

  const totalKnown = detail.present.length + detail.onLeave.length
  const totalRoster =
    totalKnown + (detail.absent?.length ?? 0)
  const presentRate = totalRoster > 0
    ? Math.round((detail.present.length / totalRoster) * 100)
    : 0

  const tabs: { id: RosterTab; label: string; count: number }[] = [
    { id: 'present', label: 'Present', count: detail.present.length },
    { id: 'leave', label: 'On leave', count: detail.onLeave.length },
    {
      id: 'absent',
      label: 'Absent',
      count: detail.absent?.length ?? 0,
    },
  ]

  const activeList: RosterMember[] =
    tab === 'present'
      ? detail.present
      : tab === 'leave'
        ? detail.onLeave
        : (detail.absent ?? [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activeList
    return activeList.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.subtitle?.toLowerCase().includes(q) ?? false),
    )
  }, [activeList, query])

  const emptyHint =
    tab === 'present'
      ? 'Nobody worked on this day.'
      : tab === 'leave'
        ? 'No approved leave on this day.'
        : 'Everyone is accounted for.'

  return (
    <div className="flex flex-col gap-4">
      {/* Subtle context strip — single line, no big tiles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border/60 pb-3 text-[12px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {totalRoster}
          </span>{' '}
          on roster
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {presentRate}%
          </span>{' '}
          attendance
        </span>
        {detail.onLeave.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>
              <span className="font-semibold text-foreground tabular-nums">
                {detail.onLeave.length}
              </span>{' '}
              on approved leave
            </span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setQuery('')
              }}
              className={cn(
                'relative inline-flex items-center gap-2 px-3 py-2 text-[12px] font-semibold transition-colors',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {t.count}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      {activeList.length > 5 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tabs.find((t) => t.id === tab)?.label.toLowerCase()}...`}
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
      )}

      {/* List */}
      {activeList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 py-10 text-center">
          <p className="text-[13px] font-semibold text-foreground">
            {emptyHint}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 py-10 text-center">
          <p className="text-[13px] font-semibold text-foreground">
            No match for “{query}”
          </p>
          <p className="text-[11px] text-muted-foreground">
            Try a different name.
          </p>
        </div>
      ) : (
        <ul
          className="grid max-h-[420px] grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2"
        >
          {filtered.map((m) => (
            <MemberRow key={m.userId} member={m} />
          ))}
        </ul>
      )}
    </div>
  )
}

function MemberRow({ member }: { member: RosterMember }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 transition-colors hover:border-border hover:bg-muted/40">
      <Avatar name={member.name} url={member.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">
          {member.name}
        </p>
        {member.subtitle && (
          <p className="truncate text-[11px] text-muted-foreground">
            {member.subtitle}
          </p>
        )}
      </div>
    </li>
  )
}


function buildDayDetail(
  year: number,
  month: number,
  day: number,
  presentByDay: CalendarMember[][],
  dayOffByDay: Map<string, CalendarDayOff>[],
  roster?: MonthAttendanceCalendarProps['roster'],
) {
  const present = presentByDay[day - 1] ?? []
  const presentIds = new Set(present.map((m) => m.userId))

  const dayOffMap = dayOffByDay[day - 1] ?? new Map<string, CalendarDayOff>()
  // Roster lookup so we can resolve avatar/email for an on-leave user
  // who isn't in the present list.
  const rosterById = new Map<string, NonNullable<MonthAttendanceCalendarProps['roster']>[number]>(
    (roster ?? []).map((r) => [r.userId, r]),
  )

  const onLeave = Array.from(dayOffMap.values()).map((d) => {
    const profile = rosterById.get(d.userId)
    return {
      userId: d.userId,
      name: profile?.name ?? d.userName,
      avatarUrl: profile?.avatarUrl,
      subtitle: d.reason || 'Approved leave',
    }
  })
  const onLeaveIds = new Set(onLeave.map((o) => o.userId))

  // Absent = roster − present − on-leave. The on-leave bucket gets
  // priority because "on leave" is a real status, not a no-show.
  const absent = roster
    ? roster
        .filter(
          (u) => !presentIds.has(u.userId) && !onLeaveIds.has(u.userId),
        )
        .map((u) => ({
          userId: u.userId,
          name: u.name,
          avatarUrl: u.avatarUrl,
        }))
    : null

  const date = new Date(year, month - 1, day)
  const label = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return {
    label,
    present: present.map((m) => ({
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
    })),
    onLeave,
    absent,
  }
}
