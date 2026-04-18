'use client'

import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'

interface ProjectStatStripProps {
  total: number
  active: number
  completed: number
  atRisk: number
}

export function ProjectStatStrip({
  total,
  active,
  completed,
  atRisk,
}: ProjectStatStripProps) {
  const items: StatCardItem[] = [
    {
      key: 'total',
      label: 'Total',
      value: total,
      accent: 'text-indigo-700',
    },
    {
      key: 'active',
      label: 'Active',
      value: active,
      accent: 'text-blue-700',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: completed,
      accent: 'text-emerald-700',
    },
    {
      key: 'at-risk',
      label: 'At risk',
      value: atRisk,
      accent: atRisk > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
  ]

  return <StatCardsGrid items={items} columns={4} />
}
