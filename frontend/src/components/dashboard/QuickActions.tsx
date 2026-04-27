'use client'

import Link from 'next/link'
import {
  FolderPlus,
  UserPlus,
  BarChart3,
  CheckSquare,
  FileText,
  Calendar,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'

interface Action {
  key: string
  label: string
  description: string
  href: string
  icon: LucideIcon
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
    },
    {
      key: 'daily-update',
      label: 'Daily update',
      description: "Submit today's work",
      href: '/task-updates',
      icon: FileText,
    },
    {
      key: 'day-off',
      label: 'Request day off',
      description: 'Time away from work',
      href: '/day-offs',
      icon: Calendar,
    },
  ]

  const adminActions: Action[] = [
    {
      key: 'project',
      label: 'New project',
      description: 'Start a workspace',
      href: '/projects',
      icon: FolderPlus,
    },
    {
      key: 'invite',
      label: 'Invite user',
      description: 'Add a teammate',
      href: '/admin/users',
      icon: UserPlus,
    },
    {
      key: 'report',
      label: 'View reports',
      description: 'Time & activity',
      href: '/reports',
      icon: BarChart3,
    },
  ]

  const visible = role === 'MEMBER' ? memberActions : adminActions

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {visible.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.key}
            href={a.href}
            className="group flex items-start justify-between gap-3 rounded-md border border-border/70 bg-card px-4 py-3.5 transition-colors hover:border-foreground/30 hover:bg-muted/30"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Icon
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                strokeWidth={1.8}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {a.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.description}
                </p>
              </div>
            </div>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
              strokeWidth={1.8}
            />
          </Link>
        )
      })}
    </div>
  )
}
