'use client'

import { useState } from 'react'
import { Copy, Check, MailCheck, Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/AvatarUpload'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

export interface MissingSubmitter {
  userId: string
  userName: string
  userEmail: string
  employeeId?: string
  hoursLogged: number
  sessionCount: number
  avatarUrl?: string
}

interface MissingSubmittersListProps {
  items: MissingSubmitter[]
  isToday: boolean
}

function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0 && mins === 0) return '0m'
  return hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`
}

export function MissingSubmittersList({
  items,
  isToday,
}: MissingSubmittersListProps) {
  const toast = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function handleCopyOne(item: MissingSubmitter) {
    const ok = await copy(item.userEmail)
    if (!ok) {
      toast.error('Could not copy email')
      return
    }
    setCopiedId(item.userId)
    toast.success(`Copied ${item.userEmail}`)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleCopyAll() {
    const emails = items.map((i) => i.userEmail).join(', ')
    const ok = await copy(emails)
    if (!ok) {
      toast.error('Could not copy emails')
      return
    }
    setCopiedAll(true)
    toast.success(`Copied ${items.length} email${items.length === 1 ? '' : 's'}`)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6 text-emerald-500" strokeWidth={1.5} />}
        title={isToday ? 'Everyone is up to date' : 'All caught up for this day'}
        description={
          isToday
            ? 'Every team member who worked today has submitted their update.'
            : 'Every team member who logged hours on this day submitted their update.'
        }
      />
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            {items.length} team member{items.length === 1 ? '' : 's'} missing
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyAll}
          className="gap-1.5"
        >
          {copiedAll ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy all emails
        </Button>
      </div>

      <ul className="divide-y divide-border/60">
        {items.map((m) => (
          <li
            key={m.userId}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
          >
            <Avatar url={m.avatarUrl} name={m.userName} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {m.userName}
                </p>
                {m.employeeId && (
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {m.employeeId}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {m.userEmail}
              </p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="text-xs font-bold tabular-nums text-foreground">
                {formatHours(m.hoursLogged)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {m.sessionCount} session{m.sessionCount === 1 ? '' : 's'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyOne(m)}
              className={cn(
                'gap-1.5 shrink-0',
                copiedId === m.userId && 'text-emerald-600'
              )}
            >
              {copiedId === m.userId ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Email
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
