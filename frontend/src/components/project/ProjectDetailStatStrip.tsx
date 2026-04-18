'use client'

import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'

interface ProjectDetailStatStripProps {
  members: number
  totalTasks: number
  activeTasks: number
  doneTasks: number
  trackedLabel?: string | null
  completionPercent?: number
}

export function ProjectDetailStatStrip({
  members,
  totalTasks,
  activeTasks,
  doneTasks,
  trackedLabel,
  completionPercent,
}: ProjectDetailStatStripProps) {
  const items: StatCardItem[] = [
    {
      key: 'members',
      label: 'Members',
      value: members,
      accent: 'text-indigo-700',
    },
    {
      key: 'tasks',
      label: 'Tasks',
      value: totalTasks,
      accent: 'text-foreground',
    },
    {
      key: 'active',
      label: 'Active',
      value: activeTasks,
      accent: 'text-blue-700',
    },
    {
      key: 'done',
      label: 'Done',
      value: doneTasks,
      accent: 'text-emerald-700',
    },
  ]

  if (trackedLabel) {
    items.push({
      key: 'tracked',
      label: 'Tracked',
      value: trackedLabel,
      accent: 'text-violet-700',
    })
  }

  if (typeof completionPercent === 'number' && totalTasks > 0) {
    items.push({
      key: 'complete',
      label: 'Complete',
      value: `${completionPercent}%`,
      accent:
        completionPercent >= 100
          ? 'text-emerald-700'
          : completionPercent >= 50
            ? 'text-primary'
            : 'text-amber-700',
    })
  }

  return (
    <StatCardsGrid
      items={items}
      columns={items.length >= 5 ? 6 : (items.length as 3 | 4)}
    />
  )
}
