'use client'

import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/Input'
import { orgsApi } from '@/lib/api/orgsApi'

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,29}$/
const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'help', 'docs', 'status',
  'signup', 'login', 'cdn', 'assets', 'static', 'staging', 'dev',
  'test', 'demo', 'support', 'blog', 'home', 'about', 'pricing',
  'taskflow', 'neurostack',
])

type Status =
  | 'idle'
  | 'checking'
  | 'invalid'
  | 'reserved'
  | 'available' // signup mode: slug is free
  | 'taken'     // signup mode: slug already exists
  | 'found'     // lookup mode: slug resolves to an org
  | 'notFound'  // lookup mode: slug does not exist
  | 'error'

interface WorkspaceFieldProps {
  value: string
  onChange: (slug: string) => void
  /** signup: 404 from /orgs/by-slug is a good thing (slug is free).
   *  lookup: 200 is a good thing (workspace exists). */
  mode?: 'signup' | 'lookup'
  label?: string
  autoFocus?: boolean
  error?: string
}

interface ApiError {
  status?: number
}

export function WorkspaceField({
  value,
  onChange,
  mode = 'signup',
  label = 'Workspace code',
  autoFocus,
  error,
}: WorkspaceFieldProps) {
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    const slug = value.trim().toLowerCase()
    if (!slug) {
      setStatus('idle')
      return
    }
    if (RESERVED_SLUGS.has(slug)) {
      setStatus('reserved')
      return
    }
    if (!SLUG_PATTERN.test(slug)) {
      setStatus('invalid')
      return
    }

    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        await orgsApi.getBySlug(slug)
        // 200 — workspace exists
        setStatus(mode === 'signup' ? 'taken' : 'found')
      } catch (e: unknown) {
        const err = e as ApiError
        if (err?.status === 404) {
          setStatus(mode === 'signup' ? 'available' : 'notFound')
        } else {
          setStatus('error')
        }
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [value, mode])

  const statusHint = (() => {
    switch (status) {
      case 'checking':
        return { text: 'Checking...', color: 'text-muted-foreground/70' }
      case 'invalid':
        return {
          text: 'Use 3–30 lowercase letters, numbers, or hyphens',
          color: 'text-red-500',
        }
      case 'reserved':
        return { text: 'That name is reserved', color: 'text-red-500' }
      case 'available':
        return { text: '✓ Available', color: 'text-emerald-600' }
      case 'taken':
        return { text: 'Already taken', color: 'text-red-500' }
      case 'found':
        return { text: '✓ Workspace found', color: 'text-emerald-600' }
      case 'notFound':
        return { text: 'Workspace not found', color: 'text-red-500' }
      case 'error':
        return { text: 'Lookup failed — try again', color: 'text-red-500' }
      default:
        return null
    }
  })()

  return (
    <div>
      <Input
        label={label}
        type="text"
        placeholder="acme"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        autoFocus={autoFocus}
        error={error}
      />
      {statusHint && (
        <p className={`mt-1 text-xs ${statusHint.color}`}>{statusHint.text}</p>
      )}
    </div>
  )
}
