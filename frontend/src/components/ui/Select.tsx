'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Select({ options, value, onChange, placeholder = 'Select...', className, disabled }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const updatePos = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dropHeight = Math.min(options.length * 36 + 8, 240)
    const spaceBelow = window.innerHeight - rect.bottom

    setPos({
      top: spaceBelow >= dropHeight ? rect.bottom + 4 : Math.max(4, rect.top - dropHeight - 4),
      left: rect.left,
      width: rect.width,
    })
  }

  useEffect(() => {
    if (!open) return
    updatePos()

    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (ref.current && !ref.current.contains(target) && !target.closest?.('[data-select-dropdown]')) {
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={clsx(
          'w-full flex items-center justify-between rounded-xl border bg-white px-4 py-2.5 text-sm text-left transition-all',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400',
          disabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'border-gray-200 hover:border-gray-300 cursor-pointer',
          !value && !disabled && 'text-gray-400',
          value && !disabled && 'text-gray-900',
          className,
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg className={clsx('w-4 h-4 flex-shrink-0 transition-transform', open && 'rotate-180', disabled ? 'text-gray-300' : 'text-gray-400')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          data-select-dropdown
          className="fixed z-[9999] bg-white rounded-xl shadow-2xl ring-1 ring-gray-200/50 py-1 animate-fade-in-scale overflow-y-auto"
          style={{ animationDuration: '0.1s', top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: 240 }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={clsx(
                'w-full text-left px-4 py-2 text-sm transition-colors',
                value === opt.value
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
