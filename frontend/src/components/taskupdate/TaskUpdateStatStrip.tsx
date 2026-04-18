'use client'

import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'

interface TaskUpdateStatStripProps {
  teamSize: number
  submitted: number
  missing: number
  totalHoursLabel: string
  avgHoursLabel: string
}

export function TaskUpdateStatStrip({
  teamSize,
  submitted,
  missing,
  totalHoursLabel,
  avgHoursLabel,
}: TaskUpdateStatStripProps) {
  const items: StatCardItem[] = [
    {
      key: 'team',
      label: 'Team worked',
      value: teamSize,
      accent: 'text-indigo-700',
    },
    {
      key: 'submitted',
      label: 'Submitted',
      value: submitted,
      accent: 'text-emerald-700',
    },
    {
      key: 'missing',
      label: 'Missing',
      value: missing,
      accent: missing > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      key: 'total-hours',
      label: 'Total hours',
      value: totalHoursLabel,
      accent: 'text-blue-700',
    },
    {
      key: 'avg',
      label: 'Avg / person',
      value: avgHoursLabel,
      accent: 'text-violet-700',
    },
  ]

  return <StatCardsGrid items={items} columns={5} />
}
