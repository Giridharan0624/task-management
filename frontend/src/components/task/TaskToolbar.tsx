'use client'

import * as React from 'react'
import {
  Search,
  X,
  List as ListIcon,
  KanbanSquare,
  SlidersHorizontal,
  Users,
  User,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Badge } from '@/components/ui/Badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'
import type { TaskPriority } from '@/types/task'

export type ViewMode = 'list' | 'board'
export type GroupBy = 'none' | 'project' | 'status' | 'priority' | 'assignee' | 'deadline'
export type Scope = 'mine' | 'team'
export type SortBy = 'default' | 'priority' | 'deadline' | 'title' | 'status'

export interface TaskFilters {
  search: string
  priority: 'ALL' | TaskPriority
  status: 'ALL' | string
  sort: SortBy
  overdueOnly: boolean
}

export const EMPTY_FILTERS: TaskFilters = {
  search: '',
  priority: 'ALL',
  status: 'ALL',
  sort: 'default',
  overdueOnly: false,
}

interface TaskToolbarProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  scope: Scope
  onScopeChange: (scope: Scope) => void
  showScopeToggle: boolean
  groupByOptions?: GroupBy[]
}

const DEFAULT_GROUPBY_OPTIONS: GroupBy[] = [
  'none',
  'project',
  'status',
  'priority',
  'assignee',
  'deadline',
]

const GROUPBY_LABELS: Record<GroupBy, string> = {
  none: 'No grouping',
  project: 'Project',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  deadline: 'Deadline',
}

export function TaskToolbar({
  filters,
  onFiltersChange,
  view,
  onViewChange,
  groupBy,
  onGroupByChange,
  scope,
  onScopeChange,
  showScopeToggle,
  groupByOptions = DEFAULT_GROUPBY_OPTIONS,
}: TaskToolbarProps) {
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.priority !== 'ALL' ? 1 : 0) +
    (filters.status !== 'ALL' ? 1 : 0) +
    (filters.sort !== 'default' ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0

  const patch = (partial: Partial<TaskFilters>) =>
    onFiltersChange({ ...filters, ...partial })

  const clear = () => onFiltersChange(EMPTY_FILTERS)

  return (
    <div className="flex flex-col gap-3">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="min-w-[220px] flex-1">
          <Input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            leftIcon={<Search />}
            rightIcon={
              filters.search ? (
                <button
                  type="button"
                  onClick={() => patch({ search: '' })}
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

        {/* Scope toggle (admin only) */}
        {showScopeToggle && <ScopeToggle scope={scope} onChange={onScopeChange} />}

        {/* View switcher */}
        <ViewSwitcher view={view} onChange={onViewChange} />

        {/* Group-by dropdown */}
        <GroupByMenu
          value={groupBy}
          onChange={onGroupByChange}
          options={groupByOptions}
        />

        {/* Filters menu */}
        <FiltersMenu
          filters={filters}
          onChange={onFiltersChange}
          activeCount={activeFilterCount}
        />

        {/* Clear */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <ActiveChips filters={filters} onChange={onFiltersChange} />
      )}
    </div>
  )
}

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: Scope
  onChange: (s: Scope) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => onChange('mine')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
          scope === 'mine'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <User className="h-3.5 w-3.5" />
        My work
      </button>
      <button
        type="button"
        onClick={() => onChange('team')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
          scope === 'team'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Users className="h-3.5 w-3.5" />
        Team
      </button>
    </div>
  )
}

function ViewSwitcher({
  view,
  onChange,
}: {
  view: ViewMode
  onChange: (v: ViewMode) => void
}) {
  const items: { key: ViewMode; icon: React.ReactNode; label: string }[] = [
    { key: 'list', icon: <ListIcon className="h-3.5 w-3.5" />, label: 'List' },
    {
      key: 'board',
      icon: <KanbanSquare className="h-3.5 w-3.5" />,
      label: 'Board',
    },
  ]
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
            view === it.key
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {it.icon}
          <span className="hidden sm:inline">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

function GroupByMenu({
  value,
  onChange,
  options,
}: {
  value: GroupBy
  onChange: (g: GroupBy) => void
  options: GroupBy[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
          <span className="text-muted-foreground">Group:</span>
          <span className="font-semibold">{GROUPBY_LABELS[value]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Group tasks by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as GroupBy)}
        >
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt} value={opt}>
              {GROUPBY_LABELS[opt]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FiltersMenu({
  filters,
  onChange,
  activeCount,
}: {
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
  activeCount: number
}) {
  const patch = (p: Partial<TaskFilters>) => onChange({ ...filters, ...p })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2">
        <DropdownMenuLabel className="px-1 py-1">Priority</DropdownMenuLabel>
        <div className="flex gap-1 px-1 pb-2">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => patch({ priority: p })}
              className={cn(
                'flex-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors',
                filters.priority === p
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {p === 'ALL' ? 'All' : p[0] + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-1 py-1">Sort</DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 px-1 pb-2">
          {(
            [
              ['default', 'Default'],
              ['priority', 'Priority'],
              ['deadline', 'Deadline'],
              ['title', 'Title'],
              ['status', 'Status'],
            ] as [SortBy, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => patch({ sort: val })}
              className={cn(
                'rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors',
                filters.sort === val
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={filters.overdueOnly}
          onCheckedChange={(v) => patch({ overdueOnly: !!v })}
        >
          Overdue only
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActiveChips({
  filters,
  onChange,
}: {
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
}) {
  const chips: { label: string; onRemove: () => void }[] = []

  if (filters.priority !== 'ALL') {
    chips.push({
      label: `Priority: ${filters.priority[0] + filters.priority.slice(1).toLowerCase()}`,
      onRemove: () => onChange({ ...filters, priority: 'ALL' }),
    })
  }
  if (filters.status !== 'ALL') {
    chips.push({
      label: `Status: ${filters.status.replace(/_/g, ' ').toLowerCase()}`,
      onRemove: () => onChange({ ...filters, status: 'ALL' }),
    })
  }
  if (filters.sort !== 'default') {
    chips.push({
      label: `Sort: ${filters.sort}`,
      onRemove: () => onChange({ ...filters, sort: 'default' }),
    })
  }
  if (filters.overdueOnly) {
    chips.push({
      label: 'Overdue only',
      onRemove: () => onChange({ ...filters, overdueOnly: false }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {c.label}
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  )
}

// Re-export for callers that want the primitive filter-select standalone
export { FilterSelect, Badge }
