'use client'

import { useEffect, useState } from 'react'
import { Download, Monitor, Apple } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface Release {
  version: string
  released_at?: string
  downloads: Record<string, string>
}

const FALLBACK_URL =
  'https://github.com/Giridharan0624/taskflow-desktop/releases/latest'

function detectOS(): 'windows' | 'linux' | 'macos' {
  if (typeof navigator === 'undefined') return 'windows'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'windows'
}

export function DesktopAppCard() {
  const [latest, setLatest] = useState<Release | null>(null)

  useEffect(() => {
    fetch('https://dp2uotzxlo5a5.cloudfront.net/releases/latest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLatest(data as Release)
      })
      .catch(() => {})
  }, [])

  const userOS = detectOS()
  const version = latest?.version ?? '1.0.0'
  const platforms: {
    key: 'windows' | 'linux' | 'macos'
    label: string
    ext: string
    size: string
    Icon: React.ComponentType<{ className?: string }>
  }[] = [
    { key: 'windows', label: 'Windows', ext: '.exe', size: '~5 MB', Icon: Monitor },
    { key: 'linux', label: 'Linux', ext: '.AppImage', size: '~6 MB', Icon: Monitor },
    { key: 'macos', label: 'macOS', ext: '.dmg', size: '~11 MB', Icon: Apple },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Desktop app</h3>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          v{version}
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="mb-4 text-xs text-muted-foreground">
          Track time, monitor activity, and capture screenshots with the desktop
          companion app.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {platforms.map((p) => {
            const url = latest?.downloads?.[p.key] ?? FALLBACK_URL
            const isUserOS = p.key === userOS
            return (
              <a
                key={p.key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-all hover:-translate-y-0.5 hover:shadow-card-hover',
                  isUserOS
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/40'
                )}
              >
                {isUserOS && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-foreground">
                    For you
                  </span>
                )}
                <p.Icon
                  className={cn(
                    'h-6 w-6 transition-colors',
                    isUserOS
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-primary'
                  )}
                />
                <div className="text-center">
                  <p
                    className={cn(
                      'text-xs font-bold',
                      isUserOS
                        ? 'text-primary'
                        : 'text-foreground group-hover:text-primary'
                    )}
                  >
                    {p.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {p.ext} · {p.size}
                  </p>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
