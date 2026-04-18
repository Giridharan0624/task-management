'use client'

import Link from 'next/link'
import {
  FolderPlus,
  UserPlus,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface Action {
  key: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  accent: string
}

interface QuickActionsProps {
  role: 'OWNER' | 'ADMIN'
}

export function QuickActions({ role }: QuickActionsProps) {
  const actions: Action[] = [
    {
      key: 'project',
      label: 'New project',
      description: 'Start a workspace',
      href: '/projects',
      icon: FolderPlus,
      accent:
        'bg-gradient-to-br from-primary/10 to-primary/5 text-primary hover:from-primary/15 hover:to-primary/10',
    },
    {
      key: 'invite',
      label: 'Invite user',
      description: 'Add a teammate',
      href: '/admin/users',
      icon: UserPlus,
      accent:
        'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 hover:from-emerald-200 hover:to-emerald-100',
    },
    {
      key: 'report',
      label: 'View reports',
      description: 'Time & activity',
      href: '/reports',
      icon: BarChart3,
      accent:
        'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 hover:from-amber-200 hover:to-amber-100',
    },
  ]

  // OWNER gets the full set; ADMIN doesn't see invite (admin/users page handles it anyway,
  // but keep parity — invite is admin-capable too).
  const visible = actions
  void role

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {visible.map((a) => {
        const Icon = a.icon
        return (
          <Link key={a.key} href={a.href}>
            <Card
              className={cn(
                'group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  a.accent
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {a.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.description}
                </p>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
