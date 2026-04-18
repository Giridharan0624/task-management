'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  max?: string
  min?: string
  placeholder?: string
  className?: string
  required?: boolean
  align?: 'left' | 'right' | 'auto'
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function DatePicker({ value, onChange, max, min, placeholder = 'Select date', className, required, align = 'auto' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [showMonthList, setShowMonthList] = useState(false)
  const [showYearList, setShowYearList] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const today = new Date()
  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth())

  const updatePos = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const calHeight = 400
    const calWidth = 280
    const spaceBelow = window.innerHeight - rect.bottom

    setPos({
      top: spaceBelow >= calHeight ? rect.bottom + 4 : Math.max(4, rect.top - calHeight - 4),
      left: Math.min(rect.left, window.innerWidth - calWidth - 8),
    })
  }

  useEffect(() => {
    if (!open) return
    updatePos()

    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (ref.current && !ref.current.contains(target) && !target.closest?.('[data-datepicker-dropdown]')) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    onChange(dateStr)
    setOpen(false)
  }

  const isDisabled = (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    if (max && dateStr > max) return true
    if (min && dateStr < min) return true
    return false
  }

  const isSelected = (day: number) => {
    if (!value) return false
    return value === `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
  }

  const isToday = (day: number) => {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate()
  }

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'w-full flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-2.5 text-sm text-left transition-all hover:border-border',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400',
          !value && 'text-muted-foreground/70',
          value && 'text-foreground',
          className,
        )}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Also keep a hidden native input for form required validation */}
      {required && <input type="text" value={value} required tabIndex={-1} className="sr-only" onChange={() => {}} />}

      {/* Dropdown calendar — portal to body */}
      {open && createPortal(
        <div
          data-datepicker-dropdown
          className="fixed z-[9999] w-[280px] bg-card rounded-2xl shadow-2xl ring-1 ring-border/60 p-4 animate-fade-in-scale"
          style={{ animationDuration: '0.15s', top: pos.top, left: pos.left }}
        >
          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex items-center gap-1">
              {/* Month selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowMonthList(!showMonthList); setShowYearList(false) }}
                  className="text-[13px] font-bold text-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1 transition-all"
                >
                  {MONTHS[viewMonth].slice(0, 3)}
                  <svg className="w-3 h-3 ml-0.5 inline text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showMonthList && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-card rounded-xl shadow-2xl ring-1 ring-border/60 py-1 z-10 max-h-48 overflow-y-auto">
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setViewMonth(i); setShowMonthList(false) }}
                        className={clsx(
                          'w-full text-left px-3 py-1.5 text-xs font-medium transition-colors',
                          viewMonth === i ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-foreground/85 hover:bg-muted/40'
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowYearList(!showYearList); setShowMonthList(false) }}
                  className="text-[13px] font-bold text-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1 transition-all"
                >
                  {viewYear}
                  <svg className="w-3 h-3 ml-0.5 inline text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showYearList && (
                  <div className="absolute top-full right-0 mt-1 w-24 bg-card rounded-xl shadow-2xl ring-1 ring-border/60 py-1 z-10 max-h-48 overflow-y-auto">
                    {Array.from({ length: 100 }, (_, i) => today.getFullYear() - i).map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => { setViewYear(y); setShowYearList(false) }}
                        className={clsx(
                          'w-full text-left px-3 py-1.5 text-xs font-medium transition-colors',
                          viewYear === y ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-foreground/85 hover:bg-muted/40'
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const disabled = isDisabled(day)
              const selected = isSelected(day)
              const todayMark = isToday(day)

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  className={clsx(
                    'h-9 w-full rounded-lg text-sm font-medium transition-all duration-150',
                    disabled && 'text-gray-200 cursor-not-allowed',
                    !disabled && !selected && 'text-foreground/85 hover:bg-indigo-50 hover:text-indigo-700',
                    selected && 'bg-indigo-600 text-white shadow-sm',
                    todayMark && !selected && 'ring-1 ring-inset ring-indigo-300 font-bold text-indigo-600',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs font-semibold text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => { selectDay(today.getDate()); setViewMonth(today.getMonth()); setViewYear(today.getFullYear()) }}
              disabled={max ? todayStr > max : false}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors disabled:text-muted-foreground/50"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
