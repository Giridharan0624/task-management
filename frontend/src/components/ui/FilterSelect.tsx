'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  active?: boolean // Highlight when a non-default filter is active
}

export function FilterSelect({ value, onChange, options, className, active }: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 140) })
    }
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
          active
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        } ${className || ''}`}
      >
        <span className="truncate">{selected?.label ?? 'Select'}</span>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${active ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[10000] bg-white rounded-xl shadow-2xl ring-1 ring-gray-200/50 py-1 overflow-y-auto"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 240 }}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${
                o.value === value
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
