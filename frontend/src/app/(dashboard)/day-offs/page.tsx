'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  X,
  Plus,
  Check,
  CheckCircle2,
  XCircle,
  Filter,
  ArrowDownUp,
  Inbox,
  CalendarCheck2,
  AlertTriangle,
} from 'lucide-react'
import { getLocalToday } from '@/lib/utils/date'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  useMyDayOffs,
  usePendingDayOffs,
  useAllDayOffs,
  useCreateDayOff,
  useApproveDayOff,
  useRejectDayOff,
  useCancelDayOff,
  useDayOffBalance,
} from '@/lib/hooks/useDayOffs'
import { useUsers } from '@/lib/hooks/useUsers'
import { useHasPermission } from '@/lib/hooks/usePermission'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/AvatarUpload'
import {
  StatCardsGrid,
  type StatCardItem,
} from '@/components/ui/StatCardsGrid'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { DayOffCreateDialog } from '@/components/dayoff/DayOffCreateDialog'
import type {
  DayOffBalance,
  DayOffRequest,
  DayOffStatus,
} from '@/types/dayoff'
import { cn } from '@/lib/utils'

/* ═══ Helpers ═══ */

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatRange(start: string, end: string) {
  if (start.slice(0, 10) === end.slice(0, 10)) return fmtDate(start)
  return `${fmtDate(start)} – ${fmtDate(end)}`
}

function isThisMonth(iso: string): boolean {
  // Day-off dates come in as YYYY-MM-DD (date-only, no time). Comparing
  // via `new Date(iso)` parses them as UTC midnight, then `getMonth()`
  // converts to browser local — for a viewer west of UTC the date can
  // shift back a day and report the wrong month at month boundaries.
  // Slice the components straight from the string instead, matching
  // how getDayOffScore below already handles the same data.
  const ym = iso.slice(0, 7) // YYYY-MM
  const now = new Date()
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return ym === nowYm
}

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
    const from = new Date(
      Math.max(new Date(start).getTime(), new Date(monthStart).getTime())
    )
    const to = new Date(
      Math.min(new Date(end).getTime(), new Date(monthEnd).getTime())
    )
    daysOff +=
      Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  const score = daysOff === 0 ? 100 : daysOff <= 2 ? 75 : daysOff <= 5 ? 50 : 25
  return { score, daysOff }
}

/* ═══ Status Badge ═══ */

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  CANCELLED: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
}

function StatusBadge({ status }: { status: DayOffStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        STATUS_STYLES[status] ||
          'bg-muted text-muted-foreground ring-1 ring-inset ring-border'
      )}
    >
      {status}
    </span>
  )
}

/* ═══ Score Chip ═══ */

function ScoreChip({ score }: { score: number }) {
  const color =
    score === 100
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : score >= 75
        ? 'bg-blue-50 text-blue-700 ring-blue-200'
        : score >= 50
          ? 'bg-amber-50 text-amber-700 ring-amber-200'
          : 'bg-red-50 text-red-700 ring-red-200'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ring-inset',
        color
      )}
    >
      {score}
    </span>
  )
}

/* ═══ Main Page ═══ */

type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
type TabKey = 'pending' | 'all' | 'mine' | 'team'
type StatusFilter = 'ALL' | DayOffStatus

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All statuses',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

/* ═══ Sort keys per tab ═══ */

type AllSortKey =
  | 'recent'
  | 'oldest'
  | 'name-asc'
  | 'start-date'
  | 'status'
  | 'score-high'

const ALL_SORT_LABELS: Record<AllSortKey, string> = {
  recent: 'Newest first',
  oldest: 'Oldest first',
  'name-asc': 'Employee (A–Z)',
  'start-date': 'Start date',
  status: 'Status',
  'score-high': 'Score (high to low)',
}

type MineSortKey = 'recent' | 'oldest' | 'start-date' | 'status'

const MINE_SORT_LABELS: Record<MineSortKey, string> = {
  recent: 'Newest first',
  oldest: 'Oldest first',
  'start-date': 'Start date',
  status: 'Status',
}

type TeamSortKey = 'name-asc' | 'days-desc' | 'score-high' | 'requests-desc'

const TEAM_SORT_LABELS: Record<TeamSortKey, string> = {
  'name-asc': 'Name (A–Z)',
  'days-desc': 'Days off (most first)',
  'score-high': 'Score (high to low)',
  'requests-desc': 'Requests (most first)',
}

const STATUS_ORDER: Record<DayOffStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  CANCELLED: 3,
}

export default function DayOffsPage() {
  const { user } = useAuth()
  const role = (user?.systemRole ?? 'MEMBER') as Role
  const isOwner = role === 'OWNER'
  const isAdmin = role === 'ADMIN'
  // `isPrivileged` historically gated BOTH the view-all-requests tab
  // and the approve/reject buttons from a single hardcoded system-role
  // check. Now that tenants can edit role permissions live, these
  // need to branch on the ACTUAL permission the action requires.
  //
  //   canApprove  → `dayoff.approve`
  //   canReject   → `dayoff.reject`
  //   canListAll  → `dayoff.request.list.all`
  //
  // `useHasPermission` returns null while the /orgs/current/roles
  // fetch is in flight — we optimistically use the legacy role check
  // in that window so the first paint matches the pre-Session-8
  // behavior (no flashing disabled buttons for OWNER/ADMIN).
  const canApprovePerm = useHasPermission('dayoff.approve')
  const canRejectPerm = useHasPermission('dayoff.reject')
  const canListAllPerm = useHasPermission('dayoff.request.list.all')
  const canApprove =
    canApprovePerm === null ? isOwner || isAdmin : canApprovePerm
  const canReject =
    canRejectPerm === null ? isOwner || isAdmin : canRejectPerm
  const canListAll =
    canListAllPerm === null ? isOwner || isAdmin : canListAllPerm
  // `isPrivileged` retained as the "can I see any admin affordance"
  // umbrella — approving + rejecting + listing-all are the three
  // admin actions on this page, so the union covers every existing
  // call site.
  const isPrivileged = canApprove || canReject || canListAll

  const { data: myDayOffs, isLoading: myLoading } = useMyDayOffs()
  const { data: pendingDayOffs, isLoading: pendingLoading } =
    usePendingDayOffs()
  const { data: allDayOffs, isLoading: allLoading } = useAllDayOffs()
  const { data: allUsers } = useUsers()
  // Owner has no own balance (they can't request day-offs); skip the
  // round-trip in that case by passing the same hook unconditionally and
  // letting the BalanceWidget render-gate on isOwner.
  const { data: balance } = useDayOffBalance()

  const createMutation = useCreateDayOff()
  const approveMutation = useApproveDayOff()
  const rejectMutation = useRejectDayOff()
  const cancelMutation = useCancelDayOff()
  const confirmDialog = useConfirm()
  const toast = useToast()

  // Default tab per role — admins/owners land on Pending (most common task)
  const [tab, setTab] = useState<TabKey>(
    isPrivileged ? 'pending' : 'mine'
  )

  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [allSort, setAllSort] = useState<AllSortKey>('recent')
  const [mineSort, setMineSort] = useState<MineSortKey>('recent')
  const [teamSort, setTeamSort] = useState<TeamSortKey>('name-asc')

  /* ─── Derived data ─── */

  const pendingCount = pendingDayOffs?.length ?? 0

  const stats = useMemo((): StatCardItem[] => {
    if (isPrivileged) {
      const all = allDayOffs ?? []
      const approvedThisMonth = all.filter(
        (r) => r.status === 'APPROVED' && isThisMonth(r.updatedAt)
      ).length
      const rejectedThisMonth = all.filter(
        (r) => r.status === 'REJECTED' && isThisMonth(r.updatedAt)
      ).length
      const approvedDaysThisMonth = all
        .filter((r) => r.status === 'APPROVED')
        .reduce((sum, r) => {
          const now = new Date()
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
          const s = r.startDate.slice(0, 10)
          const e = r.endDate.slice(0, 10)
          if (s > monthEnd || e < monthStart) return sum
          const from = new Date(
            Math.max(
              new Date(s).getTime(),
              new Date(monthStart).getTime()
            )
          )
          const to = new Date(
            Math.min(new Date(e).getTime(), new Date(monthEnd).getTime())
          )
          return (
            sum +
            Math.round(
              (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
            ) +
            1
          )
        }, 0)
      return [
        {
          key: 'pending',
          label: 'Pending',
          value: pendingCount,
          accent:
            pendingCount > 0 ? 'text-amber-700' : 'text-muted-foreground',
        },
        {
          key: 'approved',
          label: 'Approved this month',
          value: approvedThisMonth,
          accent: 'text-emerald-700',
        },
        {
          key: 'rejected',
          label: 'Rejected this month',
          value: rejectedThisMonth,
          accent: 'text-red-700',
        },
        {
          key: 'days',
          label: 'Team days off',
          value: approvedDaysThisMonth,
          accent: 'text-indigo-700',
        },
      ]
    }

    // MEMBER view
    const mine = myDayOffs ?? []
    const pending = mine.filter((r) => r.status === 'PENDING').length
    const approved = mine.filter((r) => r.status === 'APPROVED').length
    const daysTaken = mine
      .filter((r) => r.status === 'APPROVED' && isThisMonth(r.startDate))
      .reduce((sum, r) => {
        const start = new Date(r.startDate.slice(0, 10))
        const end = new Date(r.endDate.slice(0, 10))
        return (
          sum +
          Math.round(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          ) +
          1
        )
      }, 0)
    const scoreData = user
      ? getDayOffScore(user.userId, allDayOffs ?? [])
      : { score: 100 }
    return [
      {
        key: 'pending',
        label: 'Pending',
        value: pending,
        accent:
          pending > 0 ? 'text-amber-700' : 'text-muted-foreground',
      },
      {
        key: 'approved',
        label: 'Approved',
        value: approved,
        accent: 'text-emerald-700',
      },
      {
        key: 'days',
        label: 'Days taken',
        value: daysTaken,
        accent: 'text-indigo-700',
      },
      {
        key: 'score',
        label: 'Score this month',
        value: scoreData.score,
        accent:
          scoreData.score === 100
            ? 'text-emerald-700'
            : scoreData.score >= 75
              ? 'text-blue-700'
              : scoreData.score >= 50
                ? 'text-amber-700'
                : 'text-red-700',
      },
    ]
  }, [isPrivileged, pendingCount, allDayOffs, myDayOffs, user])

  const availableTabs: { key: TabKey; label: string; count?: number }[] =
    useMemo(() => {
      const tabs: { key: TabKey; label: string; count?: number }[] = []
      if (isPrivileged) {
        tabs.push({
          key: 'pending',
          label: 'Pending approvals',
          count: pendingCount,
        })
        tabs.push({ key: 'all', label: 'All requests' })
      }
      if (isAdmin || role === 'MEMBER') {
        tabs.push({ key: 'mine', label: 'My requests' })
      }
      if (isOwner) {
        tabs.push({ key: 'team', label: 'Team overview' })
      }
      return tabs
    }, [isPrivileged, isAdmin, isOwner, role, pendingCount])

  /* ─── Actions ─── */

  const handleApprove = async (req: DayOffRequest) => {
    try {
      await approveMutation.mutateAsync(req.requestId)
      toast.success(`Approved ${req.userName}'s request`)
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to approve request'
      )
    }
  }

  const handleReject = async (req: DayOffRequest) => {
    const ok = await confirmDialog({
      title: `Reject ${req.userName}'s request?`,
      description:
        "This will reject the day-off request. The member will be notified.",
      confirmLabel: 'Reject',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await rejectMutation.mutateAsync(req.requestId)
      toast.success('Request rejected')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to reject request'
      )
    }
  }

  const handleCancel = async (req: DayOffRequest) => {
    const ok = await confirmDialog({
      title: 'Cancel your day-off request?',
      description:
        'This removes the request from the approval queue. This cannot be undone.',
      confirmLabel: 'Cancel request',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await cancelMutation.mutateAsync(req.requestId)
      toast.success('Request cancelled')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel request'
      )
    }
  }

  /* ─── Filters (for All Requests tab) ─── */

  const filteredAll = useMemo(() => {
    let list = allDayOffs ?? []
    if (statusFilter !== 'ALL')
      list = list.filter((r) => r.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          (r.employeeId || '').toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      )
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (allSort) {
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        case 'name-asc':
          return a.userName.localeCompare(b.userName)
        case 'start-date':
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          )
        case 'status':
          return (
            (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
          )
        case 'score-high': {
          const aScore = getDayOffScore(a.userId, allDayOffs ?? []).score
          const bScore = getDayOffScore(b.userId, allDayOffs ?? []).score
          return bScore - aScore
        }
        case 'recent':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
      }
    })
    return sorted
  }, [allDayOffs, statusFilter, search, allSort])

  const sortedMyDayOffs = useMemo(() => {
    const list = [...(myDayOffs ?? [])]
    list.sort((a, b) => {
      switch (mineSort) {
        case 'oldest':
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        case 'start-date':
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          )
        case 'status':
          return (
            (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
          )
        case 'recent':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
      }
    })
    return list
  }, [myDayOffs, mineSort])

  const sortedTeam = useMemo(() => {
    if (!allUsers || !allDayOffs) return []
    const rows = allUsers
      .filter((u) => u.systemRole !== 'OWNER')
      .map((u) => {
        const { score, daysOff } = getDayOffScore(u.userId, allDayOffs)
        const requestsThisMonth = allDayOffs.filter(
          (r) => r.userId === u.userId && isThisMonth(r.createdAt)
        ).length
        return { user: u, score, daysOff, requestsThisMonth }
      })
    rows.sort((a, b) => {
      switch (teamSort) {
        case 'days-desc':
          return b.daysOff - a.daysOff
        case 'score-high':
          return b.score - a.score
        case 'requests-desc':
          return b.requestsThisMonth - a.requestsThisMonth
        case 'name-asc':
        default:
          return (a.user.name || a.user.email).localeCompare(
            b.user.name || b.user.email
          )
      }
    })
    return rows
  }, [allUsers, allDayOffs, teamSort])

  /* ─── Render ─── */

  const pageTitle = isOwner
    ? 'Day Off Requests'
    : isAdmin
      ? 'Day Off Requests'
      : 'My Day Offs'
  const pageDescription = isPrivileged
    ? 'Review and manage employee time-off requests'
    : 'Track and request your time off'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        actions={
          !isOwner ? (
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Request day off
            </Button>
          ) : undefined
        }
      />

      <StatCardsGrid items={stats} columns={4} />

      {!isOwner && balance && balance.balances.length > 0 && (
        <LeaveBalanceCard balance={balance} />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          {availableTabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-2">
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                    t.key === 'pending'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-muted-foreground/20 text-muted-foreground'
                  )}
                >
                  {t.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Pending Approvals tab */}
        {isPrivileged && (
          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !pendingDayOffs?.length ? (
              <EmptyState
                icon={
                  <CheckCircle2
                    className="h-7 w-7 text-emerald-500/80"
                    strokeWidth={1.5}
                  />
                }
                title="No pending approvals"
                description="All requests have been reviewed. You're all caught up."
              />
            ) : (
              <div className="space-y-3">
                {pendingDayOffs.map((req) => (
                  <PendingRequestRow
                    key={req.requestId}
                    req={req}
                    avatarUrl={
                      allUsers?.find((u) => u.userId === req.userId)?.avatarUrl
                    }
                    // Pass the handler only when the caller has
                    // the matching permission — PendingRequestCard
                    // hides the button when the prop is undefined.
                    onApprove={canApprove ? () => handleApprove(req) : undefined}
                    onReject={canReject ? () => handleReject(req) : undefined}
                    isActing={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                    disableActions={req.userId === user?.userId}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* All Requests tab */}
        {isPrivileged && (
          <TabsContent value="all" className="mt-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="min-w-[220px] flex-1">
                <Input
                  type="text"
                  placeholder="Search by name, ID, or reason..."
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
                    <Filter className="h-3.5 w-3.5" />
                    <span className="font-semibold">
                      {STATUS_LABELS[statusFilter]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={(v) =>
                      setStatusFilter(v as StatusFilter)
                    }
                  >
                    {(Object.keys(STATUS_LABELS) as StatusFilter[]).map(
                      (k) => (
                        <DropdownMenuRadioItem key={k} value={k}>
                          {STATUS_LABELS[k]}
                        </DropdownMenuRadioItem>
                      )
                    )}
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
                    <span className="font-semibold">
                      {ALL_SORT_LABELS[allSort]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={allSort}
                    onValueChange={(v) => setAllSort(v as AllSortKey)}
                  >
                    {(Object.keys(ALL_SORT_LABELS) as AllSortKey[]).map(
                      (k) => (
                        <DropdownMenuRadioItem key={k} value={k}>
                          {ALL_SORT_LABELS[k]}
                        </DropdownMenuRadioItem>
                      )
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {(search || statusFilter !== 'ALL' || allSort !== 'recent') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('ALL')
                    setAllSort('recent')
                  }}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>

            {allLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : filteredAll.length === 0 ? (
              <EmptyState
                icon={
                  <Inbox
                    className="h-7 w-7 text-muted-foreground/70"
                    strokeWidth={1.5}
                  />
                }
                title="No requests found"
                description={
                  search || statusFilter !== 'ALL'
                    ? 'Try clearing filters to see more requests.'
                    : 'No day-off requests have been submitted yet.'
                }
                action={
                  search || statusFilter !== 'ALL' ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('ALL')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAll.map((req) => {
                      const scoreData = getDayOffScore(
                        req.userId,
                        allDayOffs ?? []
                      )
                      return (
                        <TableRow key={req.requestId}>
                          <TableCell>
                            <p className="font-semibold text-foreground">
                              {req.userName}
                            </p>
                            {req.employeeId && (
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {req.employeeId}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {formatRange(req.startDate, req.endDate)}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">
                            {req.reason}
                          </TableCell>
                          <TableCell className="text-xs">
                            {req.adminStatus === 'APPROVED' ||
                            req.adminStatus === 'REJECTED' ? (
                              <span className="font-medium text-foreground">
                                {req.adminName}
                              </span>
                            ) : req.status === 'CANCELLED' ? (
                              <span className="italic text-muted-foreground">
                                By member
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground">
                                Awaiting admin
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <ScoreChip score={scoreData.score} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge status={req.status} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        )}

        {/* My Requests tab */}
        {(isAdmin || role === 'MEMBER') && (
          <TabsContent value="mine" className="mt-4">
            {myLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !myDayOffs?.length ? (
              <EmptyState
                title="No requests yet"
                description="You haven't submitted any day-off requests."
                action={
                  <Button
                    onClick={() => setShowCreate(true)}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Request day off
                  </Button>
                }
              />
            ) : (
              <>
                <div className="mb-3 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 gap-1.5 text-xs"
                      >
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        <span className="font-semibold">
                          {MINE_SORT_LABELS[mineSort]}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={mineSort}
                        onValueChange={(v) => setMineSort(v as MineSortKey)}
                      >
                        {(Object.keys(MINE_SORT_LABELS) as MineSortKey[]).map(
                          (k) => (
                            <DropdownMenuRadioItem key={k} value={k}>
                              {MINE_SORT_LABELS[k]}
                            </DropdownMenuRadioItem>
                          )
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Card className="overflow-hidden p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dates</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Decision</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedMyDayOffs.map((req) => (
                        <TableRow key={req.requestId}>
                          <TableCell className="font-semibold text-foreground">
                            {formatRange(req.startDate, req.endDate)}
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate text-muted-foreground">
                            {req.reason}
                          </TableCell>
                          <TableCell className="text-xs">
                            {req.adminStatus === 'APPROVED' ||
                            req.adminStatus === 'REJECTED' ? (
                              <span className="font-medium text-foreground">
                                {req.adminName}
                              </span>
                            ) : req.status === 'CANCELLED' ? (
                              <span className="italic text-muted-foreground">
                                By you
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground">
                                Awaiting admin
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(req.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusBadge status={req.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {req.status === 'PENDING' ||
                            req.status === 'APPROVED' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(req)}
                                disabled={cancelMutation.isPending}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Card>
              </>
            )}
          </TabsContent>
        )}

        {/* Team Overview tab (OWNER only) */}
        {isOwner && (
          <TabsContent value="team" className="mt-4">
            {!allUsers || !allDayOffs ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="mb-3 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 gap-1.5 text-xs"
                      >
                        <ArrowDownUp className="h-3.5 w-3.5" />
                        <span className="font-semibold">
                          {TEAM_SORT_LABELS[teamSort]}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={teamSort}
                        onValueChange={(v) => setTeamSort(v as TeamSortKey)}
                      >
                        {(Object.keys(TEAM_SORT_LABELS) as TeamSortKey[]).map(
                          (k) => (
                            <DropdownMenuRadioItem key={k} value={k}>
                              {TEAM_SORT_LABELS[k]}
                            </DropdownMenuRadioItem>
                          )
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Card className="overflow-hidden p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-center">
                          Days off
                        </TableHead>
                        <TableHead className="text-center">
                          Requests this month
                        </TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTeam.map(
                        ({ user: u, score, daysOff, requestsThisMonth }) => (
                          <TableRow key={u.userId}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar
                                  url={u.avatarUrl}
                                  name={u.name || u.email}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {u.name || u.email}
                                  </p>
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.systemRole}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-foreground">
                              {daysOff}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-muted-foreground">
                              {requestsThisMonth}
                            </TableCell>
                            <TableCell className="text-right">
                              <ScoreChip score={score} />
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      <DayOffCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        isPending={createMutation.isPending}
        onCreate={(data) => {
          createMutation.mutate(data, {
            onSuccess: () => {
              setShowCreate(false)
              toast.success('Day-off request submitted')
            },
          })
        }}
      />
    </div>
  )
}

/* ═══ Leave Balance Card ═══ */

function LeaveBalanceCard({ balance }: { balance: DayOffBalance }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          Leave balance · {balance.year}
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Approved + pending counted
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balance.balances.map((b) => {
          const total = b.quota || 1
          const usedPct = Math.min(100, Math.round((b.used / total) * 100))
          const pendingPct = Math.min(
            100 - usedPct,
            Math.round((b.pending / total) * 100)
          )
          const overQuota = b.used + b.pending > b.quota
          return (
            <div
              key={b.leaveTypeId}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {b.name}
                </p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  <span
                    className={cn(
                      'font-bold',
                      overQuota ? 'text-red-700' : 'text-foreground'
                    )}
                  >
                    {b.remaining}
                  </span>{' '}
                  / {b.quota} left
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="flex h-full w-full">
                  <div
                    className={cn(
                      'h-full',
                      overQuota ? 'bg-red-500' : 'bg-indigo-500'
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${pendingPct}%` }}
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {b.used} used
                {b.pending > 0 ? ` · ${b.pending} pending` : ''}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ═══ Pending Request Row ═══ */

function PendingRequestRow({
  req,
  avatarUrl,
  onApprove,
  onReject,
  isActing,
  disableActions,
}: {
  req: DayOffRequest
  avatarUrl?: string
  /** Undefined when the caller lacks `dayoff.approve` — the button
   *  is hidden entirely rather than shown disabled. */
  onApprove?: () => void
  /** Undefined when the caller lacks `dayoff.reject`. */
  onReject?: () => void
  isActing: boolean
  disableActions?: boolean
}) {
  // Legacy records (made before backend validation shipped) can still be
  // pending for dates in the past. Flag them so admins spot the staleness
  // instead of rubber-stamping a request that's already moot.
  //   expired       → end date is before today (entire range in the past)
  //   startedInPast → start is before today, but end is still today or later
  const today = getLocalToday()
  const startDay = req.startDate.slice(0, 10)
  const endDay = req.endDate.slice(0, 10)
  const isExpired = endDay < today
  const startedInPast = !isExpired && startDay < today

  return (
    <Card
      className={cn('p-4', isExpired && 'border-amber-500/40 bg-amber-500/5')}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Avatar url={avatarUrl} name={req.userName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-foreground">
              {req.userName}
            </p>
            {req.employeeId && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {req.employeeId}
              </span>
            )}
            {(isExpired || startedInPast) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {isExpired ? 'Date passed' : 'Started in past'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {formatRange(req.startDate, req.endDate)}
          </p>
          <p className="mt-1.5 text-sm text-foreground leading-relaxed">
            <span className="font-semibold text-muted-foreground">
              Reason:
            </span>{' '}
            {req.reason}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Requested {fmtDate(req.createdAt)}
            {isExpired && (
              <span className="ml-2 text-amber-700 dark:text-amber-400">
                · This request is already in the past. Reject to clear.
              </span>
            )}
          </p>
        </div>
        {!disableActions && (onApprove || onReject) && (
          <div className="flex shrink-0 gap-2">
            {onApprove && (
              <Button
                variant="primary"
                size="sm"
                onClick={onApprove}
                disabled={isActing || isExpired}
                className="gap-1.5"
                title={isExpired ? 'The date is already in the past' : undefined}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
            )}
            {onReject && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onReject}
                disabled={isActing}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            )}
          </div>
        )}
        {disableActions && (
          <span className="shrink-0 text-[10px] italic text-muted-foreground">
            (your own request)
          </span>
        )}
      </div>
    </Card>
  )
}
