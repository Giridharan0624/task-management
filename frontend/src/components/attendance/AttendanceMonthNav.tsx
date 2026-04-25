'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

interface AttendanceMonthNavProps {
  year: number
  month: number // 1-12
  onChange: (year: number, month: number) => void
}

/**
 * Prev / label / next month navigator. The label itself is a button —
 * clicking it opens a compact picker (year stepper + 12-month grid) so
 * the user can jump to any month/year in one or two clicks rather than
 * stepping through 12 chevrons. Future months are disabled. A "Jump to
 * current" link surfaces when the user has navigated away from today.
 */
export function AttendanceMonthNav({
  year,
  month,
  onChange,
}: AttendanceMonthNavProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const canGoForward =
    year < currentYear || (year === currentYear && month < currentMonth)
  const isCurrent = year === currentYear && month === currentMonth

  const label = useMemo(
    () =>
      new Date(year, month - 1).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [year, month],
  )

  const shift = (by: number) => {
    const d = new Date(year, month - 1 + by, 1)
    onChange(d.getFullYear(), d.getMonth() + 1)
  }

  // Picker is its own state — closes on selection, syncs its working
  // year to the active selection whenever it opens so the user always
  // starts from "where they are".
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const handlePickerChange = (open: boolean) => {
    if (open) setPickerYear(year)
    setPickerOpen(open)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shift(-1)}
          className="h-7 w-7"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <Popover open={pickerOpen} onOpenChange={handlePickerChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Pick a month — currently ${label}`}
              className="min-w-[140px] rounded-md px-2 py-1 text-center text-sm font-semibold tabular-nums text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {label}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-[280px] p-3">
            <MonthPicker
              activeYear={year}
              activeMonth={month}
              pickerYear={pickerYear}
              onPickerYearChange={setPickerYear}
              currentYear={currentYear}
              currentMonth={currentMonth}
              onSelect={(y, m) => {
                onChange(y, m)
                setPickerOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => shift(1)}
          disabled={!canGoForward}
          className="h-7 w-7"
          aria-label="Next month"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!isCurrent && (
        <Button
          variant="link"
          size="sm"
          onClick={() => onChange(currentYear, currentMonth)}
          className="h-auto"
        >
          Jump to current
        </Button>
      )}
    </div>
  )
}

interface MonthPickerProps {
  /** The selection currently shown on the calendar. Drives the
   *  highlighted month chip when the picker is browsing the same year. */
  activeYear: number
  activeMonth: number
  /** The year the picker is currently displaying — independent of the
   *  active selection so the user can browse before committing. */
  pickerYear: number
  onPickerYearChange: (year: number) => void
  /** Real-world today, used to gray out future months. */
  currentYear: number
  currentMonth: number
  onSelect: (year: number, month: number) => void
}

const MONTH_LABELS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function MonthPicker({
  activeYear,
  activeMonth,
  pickerYear,
  onPickerYearChange,
  currentYear,
  currentMonth,
  onSelect,
}: MonthPickerProps) {
  const canGoForwardYear = pickerYear < currentYear

  return (
    <div className="flex flex-col gap-3">
      {/* Year stepper */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPickerYearChange(pickerYear - 1)}
          className="h-7 w-7"
          aria-label="Previous year"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-bold tabular-nums text-foreground">
          {pickerYear}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPickerYearChange(pickerYear + 1)}
          disabled={!canGoForwardYear}
          className="h-7 w-7"
          aria-label="Next year"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 12-month grid (4 cols × 3 rows). Future months in the picker
          year are disabled so the calendar can't display data we can't
          have collected yet. */}
      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_LABELS_SHORT.map((label, i) => {
          const monthNum = i + 1
          const isFuture =
            pickerYear > currentYear ||
            (pickerYear === currentYear && monthNum > currentMonth)
          const isActive =
            pickerYear === activeYear && monthNum === activeMonth
          const isToday =
            pickerYear === currentYear && monthNum === currentMonth
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(pickerYear, monthNum)}
              disabled={isFuture}
              className={cn(
                'relative rounded-md border px-2 py-1.5 text-[12px] font-semibold transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isFuture
                    ? 'cursor-not-allowed border-transparent text-muted-foreground/40'
                    : 'border-transparent text-foreground hover:border-border hover:bg-muted',
              )}
            >
              {label}
              {isToday && !isActive && (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-primary"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
