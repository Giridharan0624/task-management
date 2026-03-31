'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from './AvatarUpload'

interface UserOption {
  userId: string
  name: string
  email: string
  avatarUrl?: string
  extra?: string // e.g. role, department
}

interface UserSelectProps {
  users: UserOption[]
  value: string
  onChange: (userId: string) => void
  placeholder?: string
  className?: string
}

export function UserSelect({ users, value, onChange, placeholder = 'Search and select user...', className }: UserSelectProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selected = users.find((u) => u.userId === value)

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase()
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.extra || '').toLowerCase().includes(q)
      })
    : users

  // Position the portal dropdown beneath the trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    })
  }, [open])

  // Close on outside click (check both trigger and dropdown)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      className="z-[10000] bg-white rounded-xl shadow-2xl ring-1 ring-gray-200/50 overflow-hidden animate-fade-in-scale"
      style={{ ...dropdownStyle, animationDuration: '0.12s' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            autoFocus
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white outline-none transition-all"
          />
        </div>
      </div>

      {/* User list */}
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No users found</p>
        ) : (
          filtered.map((u) => {
            const isActive = u.userId === value
            return (
              <button
                key={u.userId}
                type="button"
                onClick={() => { onChange(u.userId); setOpen(false); setSearch('') }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <Avatar name={u.name} url={u.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isActive ? 'font-semibold text-indigo-700' : 'font-medium text-gray-900'}`}>{u.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{u.email}{u.extra ? ` · ${u.extra}` : ''}</p>
                </div>
                {isActive && (
                  <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-left transition-all hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
      >
        {selected ? (
          <>
            <Avatar name={selected.name} url={selected.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{selected.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{selected.email}</p>
            </div>
          </>
        ) : (
          <span className="text-gray-400 flex-1">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown}
    </div>
  )
}

/** Multi-select variant with checkboxes and search */
interface UserMultiSelectProps {
  users: UserOption[]
  selected: string[]
  onChange: (userIds: string[]) => void
  placeholder?: string
  className?: string
}

export function UserMultiSelect({ users, selected, onChange, placeholder = 'Search and select users...', className }: UserMultiSelectProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase()
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.extra || '').toLowerCase().includes(q)
      })
    : users

  const toggle = (userId: string) => {
    onChange(selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId])
  }

  return (
    <div className={className}>
      {/* Search */}
      <div className="relative mb-2">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:bg-white outline-none transition-all"
        />
      </div>

      {/* User list */}
      <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No users found</p>
        ) : (
          filtered.map((u) => {
            const isSelected = selected.includes(u.userId)
            return (
              <label
                key={u.userId}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all ${isSelected ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}
              >
                <div className={`flex items-center justify-center h-5 w-5 rounded-md border-2 transition-all flex-shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(u.userId)} className="sr-only" />
                <Avatar name={u.name} url={u.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm truncate block ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{u.name}</span>
                  <span className="text-[11px] text-gray-400 truncate block">{u.email}{u.extra ? ` · ${u.extra}` : ''}</span>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
