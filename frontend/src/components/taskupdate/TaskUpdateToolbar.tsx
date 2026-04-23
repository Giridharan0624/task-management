'use client'

import { ChevronLeft, ChevronRight, Search, X, FileDown } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { cn } from '@/lib/utils'

export type TaskUpdateTab = 'submitted' | 'missing'

interface TaskUpdateToolbarProps {
  selectedDate: string
  onDateChange: (date: string) => void
  today: string
  search: string
  onSearchChange: (q: string) => void
  tab: TaskUpdateTab
  onTabChange: (t: TaskUpdateTab) => void
  submittedCount: number
  missingCount: number
  onExportCSV: () => void
  canExport: boolean
}

function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TaskUpdateToolbar({
  selectedDate,
  onDateChange,
  today,
  search,
  onSearchChange,
  tab,
  onTabChange,
  submittedCount,
  missingCount,
  onExportCSV,
  canExport,
}: TaskUpdateToolbarProps) {
  const isToday = selectedDate === today
  const canGoNext = selectedDate < today

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'short', month: 'short', day: 'numeric' }
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: date nav + search + export */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date pager */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDateChange(shiftDate(selectedDate, -1))}
            className="h-7 w-7"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {dateLabel}
            </span>
            <DatePicker
              value={selectedDate}
              onChange={onDateChange}
              max={today}
              className="h-7 w-[120px] text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => canGoNext && onDateChange(shiftDate(selectedDate, 1))}
            disabled={!canGoNext}
            className="h-7 w-7"
            aria-label="Next day"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {!isToday && (
          <Button
            variant="link"
            size="sm"
            onClick={() => onDateChange(today)}
            className="h-auto"
          >
            Go to today
          </Button>
        )}

        {/* Search — grows to fill */}
        <div className="min-w-[200px] flex-1">
          <Input
            type="text"
            placeholder="Search by name or email..."
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

        {/* Export CSV */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportCSV}
          disabled={!canExport}
          className="gap-1.5"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Row 2: tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as TaskUpdateTab)}
        className="w-full"
      >
        <TabsList className="h-9">
          <TabsTrigger value="submitted" className="gap-2 px-3 text-xs">
            Submitted
            <span
              className={cn(
                'inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                tab === 'submitted'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              )}
            >
              {submittedCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="missing" className="gap-2 px-3 text-xs">
            Missing
            <span
              className={cn(
                'inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                missingCount > 0
                  ? tab === 'missing'
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-destructive/10 text-destructive'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              )}
            >
              {missingCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
