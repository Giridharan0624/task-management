'use client'

import { Search, X, FileDown, Upload, UserPlus, Shield, Users } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

export type UsersScope = 'management' | 'members'
export type UsersSort = 'name' | 'role' | 'department' | 'joined'

interface UsersToolbarProps {
  search: string
  onSearchChange: (q: string) => void

  scope: UsersScope
  onScopeChange: (s: UsersScope) => void
  showScopeToggle: boolean
  managementCount: number
  memberCount: number

  deptFilter: string
  onDeptFilterChange: (d: string) => void
  departments: { value: string; count: number }[]

  sort: UsersSort
  onSortChange: (s: UsersSort) => void

  canClear: boolean
  onClear: () => void

  onExportCSV: () => void
  /** Hidden when undefined — list-only callers (e.g. a custom role
   *  with `user.list` but not `user.create`) don't see Add User. */
  onAddUser?: () => void
  /** OWNER-only bulk import from CSV. Optional — renders the button
   *  only when provided. */
  onBulkImport?: () => void
  addLabel: string
}

const SORT_LABELS: Record<UsersSort, string> = {
  name: 'Name',
  role: 'Role',
  department: 'Department',
  joined: 'Newest',
}

export function UsersToolbar({
  search,
  onSearchChange,
  scope,
  onScopeChange,
  showScopeToggle,
  managementCount,
  memberCount,
  deptFilter,
  onDeptFilterChange,
  departments,
  sort,
  onSortChange,
  canClear,
  onClear,
  onExportCSV,
  onAddUser,
  onBulkImport,
  addLabel,
}: UsersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="min-w-[220px] flex-1">
        <Input
          type="text"
          placeholder="Search by name, email, or department..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search />}
          rightIcon={
            search ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
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

      {/* Scope toggle (OWNER only) */}
      {showScopeToggle && (
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => onScopeChange('management')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
              scope === 'management'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            Management
            <span
              className={cn(
                'rounded px-1 text-[10px] font-bold tabular-nums',
                scope === 'management'
                  ? 'bg-primary-foreground/20'
                  : 'bg-muted-foreground/15'
              )}
            >
              {managementCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onScopeChange('members')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
              scope === 'members'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Members
            <span
              className={cn(
                'rounded px-1 text-[10px] font-bold tabular-nums',
                scope === 'members'
                  ? 'bg-primary-foreground/20'
                  : 'bg-muted-foreground/15'
              )}
            >
              {memberCount}
            </span>
          </button>
        </div>
      )}

      {/* Department filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
            <span className="text-muted-foreground">Dept:</span>
            <span className="font-semibold">
              {deptFilter === 'ALL' ? 'All' : deptFilter}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Filter by department</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={deptFilter}
            onValueChange={onDeptFilterChange}
          >
            <DropdownMenuRadioItem value="ALL">
              All departments
            </DropdownMenuRadioItem>
            {departments.map((d) => (
              <DropdownMenuRadioItem key={d.value} value={d.value}>
                <span className="flex-1">{d.value}</span>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {d.count}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
            <span className="text-muted-foreground">Sort:</span>
            <span className="font-semibold">{SORT_LABELS[sort]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(v) => onSortChange(v as UsersSort)}
          >
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="role">Role</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="department">
              Department
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="joined">
              Newest joined
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {canClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground"
        >
          Clear
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportCSV}
          className="h-9 gap-1.5"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export
        </Button>
        {onBulkImport && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onBulkImport}
            className="h-9 gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
        )}
        {onAddUser && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddUser}
            className="h-9 gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
