'use client'

import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'

type StatusKey = 'ALL' | 'TODO' | 'ACTIVE' | 'DONE' | 'OVERDUE'

interface TaskStatStripProps {
  total: number
  todo: number
  active: number
  done: number
  overdue: number
  selected: StatusKey
  onSelect: (key: StatusKey) => void
}

/**
 * Big-card stat grid for /my-tasks. Each card is a clickable filter;
 * clicking the currently-selected one resets to ALL.
 */
export function TaskStatStrip({
  total,
  todo,
  active,
  done,
  overdue,
  selected,
  onSelect,
}: TaskStatStripProps) {
  const clickFor = (key: StatusKey) => () =>
    onSelect(selected === key ? 'ALL' : key)

  const items: StatCardItem[] = [
    {
      key: 'ALL',
      label: 'Total',
      value: total,
      accent: 'text-indigo-700',
      onClick: clickFor('ALL'),
      selected: selected === 'ALL',
    },
    {
      key: 'TODO',
      label: 'To do',
      value: todo,
      accent: 'text-amber-700',
      onClick: clickFor('TODO'),
      selected: selected === 'TODO',
    },
    {
      key: 'ACTIVE',
      label: 'Active',
      value: active,
      accent: 'text-blue-700',
      onClick: clickFor('ACTIVE'),
      selected: selected === 'ACTIVE',
    },
    {
      key: 'DONE',
      label: 'Done',
      value: done,
      accent: 'text-emerald-700',
      onClick: clickFor('DONE'),
      selected: selected === 'DONE',
    },
    {
      key: 'OVERDUE',
      label: 'Overdue',
      value: overdue,
      accent: overdue > 0 ? 'text-destructive' : 'text-muted-foreground',
      onClick: clickFor('OVERDUE'),
      selected: selected === 'OVERDUE',
    },
  ]

  return <StatCardsGrid items={items} columns={5} />
}

export type { StatusKey }
