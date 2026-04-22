'use client'

import Link from 'next/link'
import {
  FolderPlus,
  UserPlus,
  BarChart3,
  CheckSquare,
  FileText,
  Calendar,
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
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export function QuickActions({ role }: QuickActionsProps) {
  // Member actions are role-appropriate — members can't create projects
  // or invite users, so the action set changes shape per role rather
  // than showing a disabled or no-op card.
  const memberActions: Action[] = [
    {
      key: 'my-tasks',
      label: 'My tasks',
      description: 'Jump to your list',
      href: '/my-tasks',
      icon: CheckSquare,
      accent:
        'bg-gradient-to-br from-primary/10 to-primary/5 text-primary hover:from-primary/15 hover:to-primary/10',
    },
    {
      key: 'daily-update',
      label: 'Daily update',
      description: "Submit today's work",
      href: '/task-updates',
      icon: FileText,
      accent:
        'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 hover:from-emerald-200 hover:to-emerald-100',
    },
    {
      key: 'day-off',
      label: 'Request day off',
      description: 'Time away from work',
      href: '/day-offs',
      icon: Calendar,
      accent:
        'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 hover:from-amber-200 hover:to-amber-100',
    },
  ]

  const adminActions: Action[] = [
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

  const visible = role === 'MEMBER' ? memberActions : adminActions

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 stagger-up">
      {visible.map((a) => {
        const Icon = a.icon
        return (
          <Link key={a.key} href={a.href} className="pressable">
            <Card
              className={cn(
                'group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover-lift-sm'
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
