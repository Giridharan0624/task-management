'use client'

import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'

interface ReportsStatStripProps {
  totalHoursLabel: string
  members: number
  sessions: number
  projects: number
}

export function ReportsStatStrip({
  totalHoursLabel,
  members,
  sessions,
  projects,
}: ReportsStatStripProps) {
  const items: StatCardItem[] = [
    {
      key: 'total',
      label: 'Total hours',
      value: totalHoursLabel,
      accent: 'text-indigo-700',
    },
    {
      key: 'members',
      label: 'Members',
      value: members,
      accent: 'text-violet-700',
    },
    {
      key: 'sessions',
      label: 'Sessions',
      value: sessions,
      accent: 'text-blue-700',
    },
    {
      key: 'projects',
      label: 'Projects',
      value: projects,
      accent: 'text-emerald-700',
    },
  ]

  return <StatCardsGrid items={items} columns={4} />
}
