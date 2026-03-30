'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface TimePickerProps {
  value: string // HH:MM (24h format)
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

function pad(n: number) { return String(n).padStart(2, '0') }

function formatDisplay(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}

export function TimePicker({ value, onChange, placeholder = 'Select time', className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  // Internal state: 12h format
  const [selHour12, setSelHour12] = useState(9) // 1-12
  const [selMin, setSelMin] = useState(0) // 0-59
  const [selPeriod, setSelPeriod] = useState<'AM' | 'PM'>('AM')

  // Sync from value prop
  useEffect(() => {
    if (value) {
      const [h24, m] = value.split(':').map(Number)
      setSelPeriod(h24 >= 12 ? 'PM' : 'AM')
      setSelHour12(h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24)
      setSelMin(m)
    }
  }, [value])

  const updatePos = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const pickerHeight = 360
    const pickerWidth = 280
    const spaceBelow = window.innerHeight - rect.bottom

    setPos({
      top: spaceBelow >= pickerHeight ? rect.bottom + 4 : Math.max(4, rect.top - pickerHeight - 4),
      left: Math.min(rect.left, window.innerWidth - pickerWidth - 8),
    })
  }

  useEffect(() => {
    if (!open) return
    updatePos()

    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (ref.current && !ref.current.contains(target) && !target.closest?.('[data-timepicker-dropdown]')) {
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

  const to24h = (h12: number, period: 'AM' | 'PM'): number => {
    if (period === 'AM') return h12 === 12 ? 0 : h12
    return h12 === 12 ? 12 : h12 + 12
  }

  const confirm = () => {
    const h24 = to24h(selHour12, selPeriod)
    onChange(`${pad(h24)}:${pad(selMin)}`)
    setOpen(false)
  }

  const hours12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  // Preview in 12h format
  const previewStr = `${selHour12}:${pad(selMin)}`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'w-full flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-left transition-all hover:border-gray-300',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400',
          !value && 'text-gray-400',
          value && 'text-gray-900',
          className,
        )}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && createPortal(
        <div
          data-timepicker-dropdown
          className="fixed z-[9999] w-[280px] bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200/50 p-4 animate-fade-in-scale"
          style={{ animationDuration: '0.12s', top: pos.top, left: pos.left }}
        >
          {/* Preview */}
          <div className="text-center mb-3">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">{previewStr}</span>
            <span className={clsx('text-sm font-bold ml-1.5', selPeriod === 'AM' ? 'text-indigo-600' : 'text-violet-600')}>{selPeriod}</span>
          </div>

          {/* AM/PM toggle */}
          <div className="flex gap-1.5 mb-3">
            {(['AM', 'PM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelPeriod(p)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all',
                  selPeriod === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Hour + Minute columns */}
          <div className="flex gap-2 mb-3">
            {/* Hours (1-12) */}
            <div className="flex-1">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center mb-1">Hour</p>
              <div className="h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50">
                {hours12.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelHour12(h)}
                    className={clsx(
                      'w-full px-2 py-1.5 text-xs font-medium text-center transition-all',
                      selHour12 === h
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700',
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes (00-59) */}
            <div className="flex-1">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center mb-1">Min</p>
              <div className="h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelMin(m)}
                    className={clsx(
                      'w-full px-2 py-1.5 text-xs font-medium text-center transition-all',
                      selMin === m
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700',
                    )}
                  >
                    :{pad(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors">
              Clear
            </button>
            <button type="button" onClick={confirm} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors">
              Set Time
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
