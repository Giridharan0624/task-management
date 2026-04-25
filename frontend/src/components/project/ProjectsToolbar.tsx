'use client'

import { Search, X, LayoutGrid, List, Plus } from 'lucide-react'
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

export type ProjectView = 'grid' | 'list'
export type ProjectDomainFilter = 'ALL' | 'DEVELOPMENT' | 'DESIGNING' | 'MANAGEMENT' | 'RESEARCH'
export type ProjectStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'AT_RISK'
export type ProjectSort = 'recent' | 'progress' | 'name' | 'members'

interface ProjectsToolbarProps {
  search: string
  onSearchChange: (q: string) => void

  domain: ProjectDomainFilter
  onDomainChange: (d: ProjectDomainFilter) => void

  status: ProjectStatusFilter
  onStatusChange: (s: ProjectStatusFilter) => void

  sort: ProjectSort
  onSortChange: (s: ProjectSort) => void

  view: ProjectView
  onViewChange: (v: ProjectView) => void

  canClear: boolean
  onClear: () => void

  canCreate: boolean
  onCreate: () => void
}

const DOMAIN_LABELS: Record<ProjectDomainFilter, string> = {
  ALL: 'All',
  DEVELOPMENT: 'Development',
  DESIGNING: 'Designing',
  MANAGEMENT: 'Management',
  RESEARCH: 'Research',
}

const STATUS_LABELS: Record<ProjectStatusFilter, string> = {
  ALL: 'All',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  AT_RISK: 'At risk',
}

const SORT_LABELS: Record<ProjectSort, string> = {
  recent: 'Most recent',
  progress: 'Progress',
  name: 'Name',
  members: 'Team size',
}

export function ProjectsToolbar({
  search,
  onSearchChange,
  domain,
  onDomainChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  canClear,
  onClear,
  canCreate,
  onCreate,
}: ProjectsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="min-w-[220px] flex-1">
        <Input
          type="text"
          placeholder="Search projects..."
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

      {/* Workflow filter — backend identifier is still `domain` */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
            <span className="text-muted-foreground">Workflow:</span>
            <span className="font-semibold">{DOMAIN_LABELS[domain]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by workflow</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={domain}
            onValueChange={(v) => onDomainChange(v as ProjectDomainFilter)}
          >
            {(Object.keys(DOMAIN_LABELS) as ProjectDomainFilter[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k}>
                {DOMAIN_LABELS[k]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 text-xs">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-semibold">{STATUS_LABELS[status]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={status}
            onValueChange={(v) => onStatusChange(v as ProjectStatusFilter)}
          >
            {(Object.keys(STATUS_LABELS) as ProjectStatusFilter[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k}>
                {STATUS_LABELS[k]}
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
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(v) => onSortChange(v as ProjectSort)}
          >
            {(Object.keys(SORT_LABELS) as ProjectSort[]).map((k) => (
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
          onClick={onClear}
          className="text-muted-foreground"
        >
          Clear
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* View switcher */}
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <ViewButton
            active={view === 'grid'}
            onClick={() => onViewChange('grid')}
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label="Grid"
          />
          <ViewButton
            active={view === 'list'}
            onClick={() => onViewChange('list')}
            icon={<List className="h-3.5 w-3.5" />}
            label="List"
          />
        </div>

        {canCreate && (
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
            className="h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        )}
      </div>
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
      aria-pressed={active}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export { DOMAIN_LABELS, STATUS_LABELS }
